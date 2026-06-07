import { ZoomIn, ZoomOut } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toUint8Array } from '@shared/binary'
import { IconButton } from '../../../components/IconButton'
import { SelectionToolbar } from '../selection/SelectionToolbar'
import {
  useDomTextSelection,
  useSelectionToolbarEffect
} from '../selection/useDomTextSelection'
import { useDomFind } from '../find/useDomFind'
import { useViewerCommand } from '../find/useViewerCommand'
import { selectAllInElement } from '../find/domFind'
import { resetPageZoom } from '../../../utils/pageZoomReset'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { useReadingProgress } from '../../../hooks/useReadingProgress'
import type { PdfTextLayerHandle } from './pdfTextLayer'
import {
  buildPagePlaceholders,
  destroyPageSlot,
  fitStaleCanvasToSlot,
  isPageNearViewport,
  markSlotNeedsRerender,
  renderPdfPage,
  resizeSlotToScale,
  type PdfPageSlot
} from './pdfLazyRender'
import {
  applyWheelZoom,
  clampPdfScale,
  computeZoomFocalScroll,
  LAZY_ROOT_MARGIN,
  MAX_CONCURRENT_PAGE_RENDERS,
  normalizeWheelDelta,
  scrollContainerToChild,
  WHEEL_ZOOM_STEP
} from './pdfViewerPerf'
import { loadPdfOutline, type PdfOutlineItem } from './pdfOutline'
import { PdfOutlinePanel } from './PdfOutlinePanel'
import { PdfSideHover } from './PdfSideHover'
import { PdfThumbnailPanel } from './PdfThumbnailPanel'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfViewerProps {
  filePath: string
  isActive?: boolean
}

export function PdfViewer({ filePath, isActive = true }: PdfViewerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const pagesRootRef = useRef<HTMLDivElement | null>(null)
  const pagesContentRef = useRef<HTMLDivElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const pageSlotsRef = useRef<Map<number, PdfPageSlot>>(new Map())
  const textLayersRef = useRef<PdfTextLayerHandle[]>([])
  const scaleRef = useRef(1.2)
  const displayScaleRef = useRef(1.2)
  const laidOutScaleRef = useRef<number | null>(null)
  const currentPageRef = useRef(1)
  const renderGenerationRef = useRef(0)
  const renderWaitQueueRef = useRef<number[]>([])
  const activeRenderCountRef = useRef(0)
  const scaleCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRafRef = useRef<number | null>(null)
  const wheelRafRef = useRef<number | null>(null)
  const wheelAccumRef = useRef({ deltaY: 0, deltaMode: 0, clientX: 0, clientY: 0 })
  const zoomFocalRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const isZoomPreviewRef = useRef(false)
  const isRescalingRef = useRef(false)
  const pendingNavigatePageRef = useRef<number | null>(null)
  const suppressFocalScrollRef = useRef(false)
  const thumbOpenRef = useRef(false)
  const outlineOpenRef = useRef(false)
  const edgeCommitRafRef = useRef<number | null>(null)
  const progressRestoredRef = useRef(false)

  const SIDE_PANEL_SETTLE_MS = 80

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1.2)
  const [displayScale, setDisplayScale] = useState(1.2)
  const [pageCount, setPageCount] = useState(0)
  const [renderedCount, setRenderedCount] = useState(0)
  const [layoutReady, setLayoutReady] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [toolbarRect, setToolbarRect] = useState<DOMRect | null>(null)
  const [pendingText, setPendingText] = useState('')
  const [outlineItems, setOutlineItems] = useState<PdfOutlineItem[]>([])
  const [outlineLoading, setOutlineLoading] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [thumbOpen, setThumbOpen] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
  const [isRescaling, setIsRescaling] = useState(false)

  const { saveProgress, loadProgress, isRestoringRef } = useReadingProgress(
    filePath,
    isActive && !loading
  )

  scaleRef.current = scale
  displayScaleRef.current = displayScale
  currentPageRef.current = currentPage
  thumbOpenRef.current = thumbOpen
  outlineOpenRef.current = outlineOpen

  const { sendToAI, setSelection } = useWorkspaceStore()
  const textSelectEnabled = isActive && !loading && pageCount > 0
  const { selection: domSelection, clearSelection: clearDomSelection } = useDomTextSelection(
    filePath,
    containerRef,
    textSelectEnabled,
    'pdf'
  )
  useSelectionToolbarEffect(domSelection, setSelection, setToolbarRect, setPendingText)
  useDomFind(containerRef.current, isActive && !loading)
  useViewerCommand(isActive && !loading, 'selectAll', () => selectAllInElement(containerRef.current))

  const clearPageSlots = useCallback((): void => {
    pageSlotsRef.current.forEach((slot) => destroyPageSlot(slot))
    pageSlotsRef.current.clear()
    textLayersRef.current.forEach((h) => h.destroy())
    textLayersRef.current = []
    renderWaitQueueRef.current = []
    activeRenderCountRef.current = 0
    setRenderedCount(0)
  }, [])

  const bumpRenderGeneration = useCallback((): number => {
    renderGenerationRef.current += 1
    renderWaitQueueRef.current = []
    return renderGenerationRef.current
  }, [])

  const ensurePageRendered = useCallback(async (pageNo: number, generation: number): Promise<void> => {
    const pdf = pdfDocRef.current
    const slot = pageSlotsRef.current.get(pageNo)
    if (!pdf || !slot || slot.rendered || slot.rendering) return
    if (generation !== renderGenerationRef.current) return

    if (slot.textHandle) {
      slot.textHandle.destroy()
      textLayersRef.current = textLayersRef.current.filter((h) => h !== slot.textHandle)
      slot.textHandle = null
    }

    slot.rendering = true
    const signal = { cancelled: () => generation !== renderGenerationRef.current }
    try {
      const textHandle = await renderPdfPage(pdf, pageNo, scaleRef.current, slot.wrap, signal)
      if (generation !== renderGenerationRef.current) {
        textHandle.destroy()
        return
      }
      slot.textHandle = textHandle
      slot.rendered = true
      textLayersRef.current.push(textHandle)
      setRenderedCount((n) => n + 1)
    } catch (err) {
      if (generation !== renderGenerationRef.current) return
      if (err instanceof Error && err.message === 'render cancelled') return
      console.error(`PDF page ${pageNo} render failed`, err)
    } finally {
      if (generation === renderGenerationRef.current) {
        slot.rendering = false
      }
    }
  }, [])

  const pumpRenderQueue = useCallback((): void => {
    if (isZoomPreviewRef.current) return
    while (
      activeRenderCountRef.current < MAX_CONCURRENT_PAGE_RENDERS &&
      renderWaitQueueRef.current.length > 0
    ) {
      const pageNo = renderWaitQueueRef.current.shift()!
      const slot = pageSlotsRef.current.get(pageNo)
      if (!slot || slot.rendered || slot.rendering) continue

      const generation = renderGenerationRef.current
      activeRenderCountRef.current += 1
      void ensurePageRendered(pageNo, generation).finally(() => {
        activeRenderCountRef.current = Math.max(0, activeRenderCountRef.current - 1)
        pumpRenderQueue()
      })
    }
  }, [ensurePageRendered])

  const queuePageRender = useCallback(
    (pageNo: number): void => {
      if (!isActiveRef.current || isZoomPreviewRef.current) return
      const slot = pageSlotsRef.current.get(pageNo)
      if (!slot || slot.rendered || slot.rendering) return
      if (renderWaitQueueRef.current.includes(pageNo)) return
      renderWaitQueueRef.current.push(pageNo)
      pumpRenderQueue()
    },
    [pumpRenderQueue]
  )

  const bootstrapVisiblePages = useCallback((): void => {
    const container = containerRef.current
    if (!container) return
    pageSlotsRef.current.forEach((slot, pageNo) => {
      if (isPageNearViewport(slot.wrap, container, 320)) {
        queuePageRender(pageNo)
      }
    })
    queuePageRender(1)
  }, [queuePageRender])

  const bootstrapVisiblePagesRef = useRef(bootstrapVisiblePages)
  bootstrapVisiblePagesRef.current = bootstrapVisiblePages

  const queuePageRenderRef = useRef(queuePageRender)
  queuePageRenderRef.current = queuePageRender

  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  const waitForZoomSettled = useCallback((onReady: () => void): void => {
    const deadline = Date.now() + 4000
    const tick = (): void => {
      if (Date.now() > deadline) {
        onReady()
        return
      }
      if (
        isRescalingRef.current ||
        isZoomPreviewRef.current ||
        scaleCommitTimerRef.current != null ||
        Math.abs(displayScaleRef.current - scaleRef.current) > 0.001
      ) {
        requestAnimationFrame(tick)
        return
      }
      onReady()
    }
    requestAnimationFrame(tick)
  }, [])

  const flushZoomPreview = useCallback((): void => {
    if (!isZoomPreviewRef.current && scaleCommitTimerRef.current == null) return
    if (scaleCommitTimerRef.current) {
      clearTimeout(scaleCommitTimerRef.current)
      scaleCommitTimerRef.current = null
    }
    isZoomPreviewRef.current = false
    const committed = clampPdfScale(displayScaleRef.current)
    displayScaleRef.current = committed
    setDisplayScale(committed)
    if (Math.abs(committed - scaleRef.current) > 0.001) {
      setScale(committed)
    }
  }, [])

  /** 左侧目录展开前提交未完成缩放，避免与 width 动画叠加 */
  const commitZoomBeforeSidePanel = useCallback((): void => {
    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      zoomFocalRef.current = {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      }
    }
    if (scaleCommitTimerRef.current) {
      clearTimeout(scaleCommitTimerRef.current)
      scaleCommitTimerRef.current = null
    }
    isZoomPreviewRef.current = false
    suppressFocalScrollRef.current = true
    const committed = clampPdfScale(displayScaleRef.current)
    displayScaleRef.current = committed
    setDisplayScale(committed)
    if (Math.abs(committed - scaleRef.current) > 0.001) {
      setScale(committed)
    } else {
      suppressFocalScrollRef.current = false
    }
    resetPageZoom()
  }, [])

  const openSidePanelSafely = useCallback(
    (open: () => void): void => {
      waitForZoomSettled(() => {
        resetPageZoom()
        globalThis.setTimeout(open, SIDE_PANEL_SETTLE_MS)
      })
    },
    [waitForZoomSettled]
  )

  const handleOutlineHoverStart = useCallback((): void => {
    outlineOpenRef.current = true
    commitZoomBeforeSidePanel()
    openSidePanelSafely(() => setOutlineOpen(true))
  }, [commitZoomBeforeSidePanel, openSidePanelSafely])

  const handleThumbHoverStart = useCallback((): void => {
    thumbOpenRef.current = true
    commitZoomBeforeSidePanel()
    openSidePanelSafely(() => setThumbOpen(true))
  }, [commitZoomBeforeSidePanel, openSidePanelSafely])

  const setThumbOpenSafe = useCallback((open: boolean): void => {
    thumbOpenRef.current = open
    setThumbOpen(open)
    if (!open) requestAnimationFrame(() => resetPageZoom())
  }, [])

  const setOutlineOpenSafe = useCallback((open: boolean): void => {
    outlineOpenRef.current = open
    setOutlineOpen(open)
    if (!open) requestAnimationFrame(() => resetPageZoom())
  }, [])

  const executeNavigateToPage = useCallback(
    (pageNo: number): void => {
      queuePageRender(pageNo)
      const generation = renderGenerationRef.current

      const applyScroll = (): boolean => {
        const root = containerRef.current
        const pageEl = root?.querySelector<HTMLElement>(`.pdf-page-wrap[data-page="${pageNo}"]`)
        if (!pageEl || !root) return false
        scrollContainerToChild(root, pageEl, 16)
        currentPageRef.current = pageNo
        setCurrentPage(pageNo)
        if (
          !isRestoringRef.current &&
          !isZoomPreviewRef.current &&
          !root.classList.contains('pdf-rescaling')
        ) {
          const max = root.scrollHeight - root.clientHeight
          if (max > 0) {
            saveProgress({
              pdfPage: pageNo,
              pdfScrollRatio: root.scrollTop / max,
              pdfScale: scaleRef.current
            })
          }
        }
        return true
      }

      void (async () => {
        await ensurePageRendered(pageNo, generation)
        const deadline = Date.now() + 8000
        while (generation === renderGenerationRef.current && Date.now() < deadline) {
          const slot = pageSlotsRef.current.get(pageNo)
          if (slot?.rendered || applyScroll()) break
          await new Promise<void>((r) => requestAnimationFrame(() => r()))
        }
        applyScroll()
      })()
    },
    [queuePageRender, ensurePageRendered, saveProgress, isRestoringRef]
  )

  const tryRunPendingNavigation = useCallback((): void => {
    const pageNo = pendingNavigatePageRef.current
    if (pageNo == null) return
    if (isRescalingRef.current) return
    const laid = laidOutScaleRef.current
    if (laid != null && Math.abs(scaleRef.current - laid) > 0.001) return
    pendingNavigatePageRef.current = null
    executeNavigateToPage(pageNo)
  }, [executeNavigateToPage])

  const tryRunPendingNavigationRef = useRef(tryRunPendingNavigation)
  tryRunPendingNavigationRef.current = tryRunPendingNavigation

  const scrollToPage = useCallback(
    (pageNo: number): void => {
      if (pageNo < 1 || pageCount <= 0 || pageNo > pageCount) return
      pendingNavigatePageRef.current = pageNo
      commitZoomBeforeSidePanel()
      tryRunPendingNavigation()
    },
    [pageCount, commitZoomBeforeSidePanel, tryRunPendingNavigation]
  )

  const storeZoomFocal = useCallback((clientX: number, clientY: number): void => {
    zoomFocalRef.current = { clientX, clientY }
  }, [])

  /** 滚轮缩放：立即提交 layout scale（无 debounce / 无 CSS transform 预览） */
  const scheduleScaleCommit = useCallback((nextDisplay: number): void => {
    const clamped = clampPdfScale(nextDisplay)
    if (scaleCommitTimerRef.current) {
      clearTimeout(scaleCommitTimerRef.current)
      scaleCommitTimerRef.current = null
    }
    isZoomPreviewRef.current = false
    displayScaleRef.current = clamped
    setDisplayScale(clamped)
    if (Math.abs(clamped - scaleRef.current) <= 0.001) return

    renderWaitQueueRef.current = []
    if (thumbOpenRef.current || outlineOpenRef.current) {
      suppressFocalScrollRef.current = true
    }
    setScale(clamped)
    requestAnimationFrame(() => resetPageZoom())
  }, [])

  const adjustZoom = useCallback(
    (delta: number): void => {
      const container = containerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        storeZoomFocal(rect.left + rect.width / 2, rect.top + rect.height / 2)
      }
      scheduleScaleCommit(displayScaleRef.current + delta)
    },
    [scheduleScaleCommit, storeZoomFocal]
  )

  useEffect(() => {
    progressRestoredRef.current = false
  }, [filePath])

  useEffect(() => {
    if (!layoutReady || progressRestoredRef.current) return
    let cancelled = false
    void loadProgress().then((saved) => {
      if (cancelled || !saved) {
        progressRestoredRef.current = true
        return
      }
      isRestoringRef.current = true
      requestAnimationFrame(() => {
        if (cancelled) return
        const container = containerRef.current
        if (!container) {
          isRestoringRef.current = false
          progressRestoredRef.current = true
          return
        }
        if (saved.pdfScrollRatio != null) {
          const maxScroll = container.scrollHeight - container.clientHeight
          container.scrollTop = saved.pdfScrollRatio * Math.max(0, maxScroll)
        } else if (saved.pdfPage != null && saved.pdfPage > 0) {
          const pageEl = container.querySelector<HTMLElement>(
            `.pdf-page-wrap[data-page="${saved.pdfPage}"]`
          )
          if (pageEl) scrollContainerToChild(container, pageEl, 16)
        }
        isRestoringRef.current = false
        progressRestoredRef.current = true
      })
    })
    return () => {
      cancelled = true
    }
  }, [layoutReady, filePath, loadProgress, isRestoringRef])

  useEffect(() => {
    if (!layoutReady || isRestoringRef.current) return
    saveProgress({ pdfScale: scale, pdfPage: currentPage })
  }, [scale, currentPage, layoutReady, saveProgress, isRestoringRef])

  useEffect(() => {
    let cancelled = false
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null

    const openPdf = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      setPageCount(0)
      setLayoutReady(false)
      setPdfReady(false)
      setOutlineItems([])
      setOutlineLoading(false)
      setOutlineOpen(false)
      setThumbOpen(false)
      laidOutScaleRef.current = null
      bumpRenderGeneration()
      clearPageSlots()

      try {
        const raw = await window.api.fs.readBinary(filePath)
        if (cancelled) return
        const saved = await window.api.readingProgress.get(filePath)
        if (cancelled) return
        if (saved?.pdfScale != null) {
          const next = clampPdfScale(saved.pdfScale)
          setScale(next)
          setDisplayScale(next)
          scaleRef.current = next
          displayScaleRef.current = next
          isZoomPreviewRef.current = false
          if (scaleCommitTimerRef.current) {
            clearTimeout(scaleCommitTimerRef.current)
            scaleCommitTimerRef.current = null
          }
        }
        loadingTask = pdfjsLib.getDocument({ data: toUint8Array(raw) })
        const pdf = await loadingTask.promise
        if (cancelled) {
          void pdf.destroy()
          return
        }

        pdfDocRef.current = pdf
        setPageCount(pdf.numPages)
        setPdfReady(true)
        setOutlineLoading(true)
        void loadPdfOutline(pdf)
          .then((items) => {
            if (!cancelled) setOutlineItems(items)
          })
          .catch(() => {
            if (!cancelled) setOutlineItems([])
          })
          .finally(() => {
            if (!cancelled) setOutlineLoading(false)
          })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '无法加载 PDF 文件')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void openPdf()
    return () => {
      cancelled = true
      loadingTask?.destroy()
      clearPageSlots()
      void pdfDocRef.current?.destroy()
      pdfDocRef.current = null
    }
  }, [filePath, clearPageSlots, bumpRenderGeneration])

  useEffect(() => {
    if (isActive) {
      if (layoutReady) {
        requestAnimationFrame(() => bootstrapVisiblePagesRef.current())
      }
      return
    }
    bumpRenderGeneration()
    renderWaitQueueRef.current = []
  }, [isActive, layoutReady, bumpRenderGeneration])

  useEffect(() => {
    const pdf = pdfDocRef.current
    const pagesContent = pagesContentRef.current
    if (!pdf || !pagesContent || loading || pageCount === 0) return

    let cancelled = false
    const layoutScale = scaleRef.current

    const setupPlaceholders = async (): Promise<void> => {
      const generation = bumpRenderGeneration()
      setLayoutReady(false)

      try {
        const placeholders = await buildPagePlaceholders(pdf, layoutScale)
        if (cancelled || generation !== renderGenerationRef.current) return

        pageSlotsRef.current.forEach((slot) => destroyPageSlot(slot))
        pageSlotsRef.current.clear()
        textLayersRef.current.forEach((h) => h.destroy())
        textLayersRef.current = []
        renderWaitQueueRef.current = []
        activeRenderCountRef.current = 0
        setRenderedCount(0)

        const frag = document.createDocumentFragment()
        placeholders.forEach(({ pageNo, wrap, baseWidth, baseHeight }) => {
          pageSlotsRef.current.set(pageNo, {
            pageNo,
            wrap,
            baseWidth,
            baseHeight,
            rendered: false,
            rendering: false,
            textHandle: null
          })
          frag.appendChild(wrap)
        })
        pagesContent.replaceChildren(frag)

        if (cancelled || generation !== renderGenerationRef.current) return
        laidOutScaleRef.current = layoutScale
        setLayoutReady(true)
        requestAnimationFrame(() => {
          if (!cancelled && generation === renderGenerationRef.current) {
            bootstrapVisiblePagesRef.current()
          }
        })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '无法准备 PDF 页面')
        }
      }
    }

    void setupPlaceholders()
    return () => {
      cancelled = true
    }
  }, [filePath, loading, pageCount, bumpRenderGeneration])

  useEffect(() => {
    const pdf = pdfDocRef.current
    const container = containerRef.current
    if (!pdf || !container || !layoutReady || laidOutScaleRef.current === null) return
    if (scale === laidOutScaleRef.current) return

    let cancelled = false
    const targetScale = scale
    const oldScale = laidOutScaleRef.current
    bumpRenderGeneration()
    const containerRect = container.getBoundingClientRect()
    const focal = zoomFocalRef.current ?? {
      clientX: containerRect.left + containerRect.width / 2,
      clientY: containerRect.top + containerRect.height / 2
    }
    const scaleFactor = targetScale / oldScale
    const scrollRatioBefore =
      container.scrollHeight > container.clientHeight
        ? container.scrollTop / (container.scrollHeight - container.clientHeight)
        : 0

    for (const slot of Array.from(pageSlotsRef.current.values())) {
      markSlotNeedsRerender(slot)
      resizeSlotToScale(slot, targetScale)
      fitStaleCanvasToSlot(slot, targetScale, oldScale)
    }

    isZoomPreviewRef.current = false
    scaleRef.current = targetScale
    setDisplayScale(targetScale)
    displayScaleRef.current = targetScale
    laidOutScaleRef.current = targetScale
    setRenderedCount(0)

    isRescalingRef.current = true
    setIsRescaling(true)

    requestAnimationFrame(() => {
      if (cancelled) return
      const pendingNav = pendingNavigatePageRef.current
      if (pendingNav == null) {
        if (suppressFocalScrollRef.current) {
          const maxScroll = container.scrollHeight - container.clientHeight
          container.scrollTop = scrollRatioBefore * Math.max(0, maxScroll)
        } else {
          const nextScroll = computeZoomFocalScroll({
            scrollLeft: container.scrollLeft,
            scrollTop: container.scrollTop,
            containerRect,
            focalClientX: focal.clientX,
            focalClientY: focal.clientY,
            scaleFactor
          })
          container.scrollLeft = nextScroll.scrollLeft
          container.scrollTop = nextScroll.scrollTop
        }
      }
      suppressFocalScrollRef.current = false
      bootstrapVisiblePagesRef.current()
      isRescalingRef.current = false
      setIsRescaling(false)
      resetPageZoom()
      tryRunPendingNavigationRef.current()
    })

    return () => {
      cancelled = true
      isRescalingRef.current = false
      setIsRescaling(false)
    }
  }, [scale, layoutReady, bumpRenderGeneration])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !layoutReady || !isActive) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (isZoomPreviewRef.current) return
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const pageNo = Number((entry.target as HTMLElement).dataset.page)
          if (pageNo > 0) queuePageRenderRef.current(pageNo)
        }
      },
      { root: container, rootMargin: LAZY_ROOT_MARGIN, threshold: 0.01 }
    )

    pageSlotsRef.current.forEach((slot) => observer.observe(slot.wrap))
    requestAnimationFrame(() => bootstrapVisiblePagesRef.current())

    return () => observer.disconnect()
  }, [layoutReady, isActive])

  useEffect(() => {
    if (!layoutReady) return
    flushZoomPreview()
  }, [layoutReady, flushZoomPreview])

  /** 缩放重绘期间移向左侧边缘时提前提交，供目录栏展开 */
  useEffect(() => {
    const host = shellRef.current
    if (!host || !layoutReady) return

    const onMove = (e: MouseEvent): void => {
      const needsCommit =
        isZoomPreviewRef.current ||
        scaleCommitTimerRef.current != null ||
        isRescalingRef.current ||
        Math.abs(displayScaleRef.current - scaleRef.current) > 0.001
      if (!needsCommit) return
      const x = e.clientX
      if (edgeCommitRafRef.current != null) return
      edgeCommitRafRef.current = requestAnimationFrame(() => {
        edgeCommitRafRef.current = null
        const rect = host.getBoundingClientRect()
        const nearLeft = x <= rect.left + 48
        if (nearLeft) commitZoomBeforeSidePanel()
      })
    }

    host.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      host.removeEventListener('mousemove', onMove)
      if (edgeCommitRafRef.current != null) cancelAnimationFrame(edgeCommitRafRef.current)
    }
  }, [layoutReady, commitZoomBeforeSidePanel])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateCurrentPage = (): void => {
      if (isZoomPreviewRef.current || isRescalingRef.current) return
      const containerTop = container.getBoundingClientRect().top
      let nextPage = currentPageRef.current
      for (const slot of Array.from(pageSlotsRef.current.values())) {
        const rect = slot.wrap.getBoundingClientRect()
        if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
          nextPage = slot.pageNo
          break
        }
      }
      if (nextPage !== currentPageRef.current) {
        currentPageRef.current = nextPage
        setCurrentPage(nextPage)
      }
    }

    const handleScroll = (): void => {
      if (scrollRafRef.current != null) return
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null
        updateCurrentPage()
        const c = containerRef.current
        if (
          c &&
          !isRestoringRef.current &&
          !isZoomPreviewRef.current &&
          !c.classList.contains('pdf-rescaling')
        ) {
          const maxScroll = c.scrollHeight - c.clientHeight
          const ratio = maxScroll > 0 ? c.scrollTop / maxScroll : 0
          saveProgress({
            pdfScrollRatio: ratio,
            pdfPage: currentPageRef.current,
            pdfScale: scaleRef.current
          })
        }
      })
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    updateCurrentPage()
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current)
    }
  }, [layoutReady, saveProgress, isRestoringRef])

  useEffect(() => {
    const handleWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      e.stopPropagation()

      wheelAccumRef.current.deltaY += e.deltaY
      wheelAccumRef.current.deltaMode = e.deltaMode
      wheelAccumRef.current.clientX = e.clientX
      wheelAccumRef.current.clientY = e.clientY

      if (wheelRafRef.current != null) return
      wheelRafRef.current = requestAnimationFrame(() => {
        wheelRafRef.current = null
        const acc = wheelAccumRef.current
        wheelAccumRef.current = { deltaY: 0, deltaMode: 0, clientX: 0, clientY: 0 }

        const normalized = normalizeWheelDelta(acc.deltaY, acc.deltaMode)
        if (Math.abs(normalized) < 4) return

        const next = applyWheelZoom(displayScaleRef.current, acc.deltaY, acc.deltaMode)
        if (Math.abs(next - displayScaleRef.current) < 0.0001) return

        storeZoomFocal(acc.clientX, acc.clientY)
        scheduleScaleCommit(next)
      })
    }

    const el = shellRef.current
    if (!el || !layoutReady) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
      if (wheelRafRef.current != null) cancelAnimationFrame(wheelRafRef.current)
    }
  }, [scheduleScaleCommit, storeZoomFocal, layoutReady])

  const closeToolbar = useCallback((): void => {
    setToolbarRect(null)
    setPendingText('')
    clearDomSelection()
  }, [clearDomSelection])

  const showViewer = !loading && !error && pageCount > 0 && layoutReady
  const showLoading = loading || (pageCount > 0 && !layoutReady)

  return (
    <div ref={wrapperRef} className="pdf-wrapper">
      <div className="pdf-toolbar">
        <IconButton icon={ZoomOut} label="缩小" onClick={() => adjustZoom(-WHEEL_ZOOM_STEP)} />
        <span>{Math.round(displayScale * 100)}%</span>
        <IconButton icon={ZoomIn} label="放大" onClick={() => adjustZoom(WHEEL_ZOOM_STEP)} />
        <span style={{ marginLeft: 16 }}>
          第 {currentPage} / {pageCount} 页
        </span>
        {pageCount > 0 && renderedCount < pageCount && !isRescaling && (
          <span className="pdf-render-progress">高清渲染 {renderedCount}/{pageCount}</span>
        )}
        {isRescaling && (
          <span className="pdf-render-progress">缩放重绘中…</span>
        )}
      </div>

      {showLoading && <div className="loading-state">正在打开 PDF...</div>}
      {error && <div className="error-state">{error}</div>}

      <div
        ref={shellRef}
        className="pdf-viewer-shell"
        style={{ display: showViewer ? 'flex' : 'none' }}
      >
        <PdfSideHover
          side="left"
          open={outlineOpen}
          setOpen={setOutlineOpenSafe}
          onHoverStart={handleOutlineHoverStart}
          label="目录"
        >
          <PdfOutlinePanel
            items={outlineItems}
            loading={outlineLoading}
            currentPage={currentPage}
            onNavigate={scrollToPage}
          />
        </PdfSideHover>

        <div ref={containerRef} className={`pdf-viewer${isRescaling ? ' pdf-rescaling' : ''}`}>
          <div ref={pagesRootRef} className="pdf-pages-root">
            <div ref={pagesContentRef} className="pdf-pages-content" />
          </div>
        </div>

        <PdfSideHover
          side="right"
          open={thumbOpen}
          setOpen={setThumbOpenSafe}
          onHoverStart={handleThumbHoverStart}
          label="缩略图"
        >
          <PdfThumbnailPanel
            pdf={pdfReady ? pdfDocRef.current : null}
            pageCount={pageCount}
            currentPage={currentPage}
            open={thumbOpen}
            onNavigate={scrollToPage}
          />
        </PdfSideHover>
      </div>

      {toolbarRect && (
        <SelectionToolbar
          rect={toolbarRect}
          onAskAI={() => {
            sendToAI(pendingText, filePath)
            closeToolbar()
          }}
          onClose={closeToolbar}
        />
      )}
    </div>
  )
}
