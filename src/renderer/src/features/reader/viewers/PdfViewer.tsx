import { ZoomIn, ZoomOut } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toUint8Array } from '@shared/binary'
import { layoutZoomProfile } from '@shared/layoutZoomProfile'
import { pdfScaleProgressPatch, savedPdfScale } from '@shared/pdfLayoutZoom'
import type { ReadingProgress } from '@shared/readingProgress'
import type { WorkbenchMode } from '@shared/types'
import { IconButton } from '../../../components/IconButton'
import { SelectionToolbar } from '../selection/SelectionToolbar'
import {
  useDomTextSelection,
  useSelectionToolbarEffect
} from '../selection/useDomTextSelection'
import { useDomFind } from '../find/useDomFind'
import { useViewerCommand } from '../find/useViewerCommand'
import { useReaderNavigate } from '../navigation/useReaderNavigate'
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
  slotHasStretchedCanvas,
  type PdfPageSlot
} from './pdfLazyRender'
import {
  applyWheelZoom,
  clampPdfScale,
  computeZoomFocalScroll,
  isZoomPreviewing,
  LAZY_ROOT_MARGIN,
  MAX_CONCURRENT_PAGE_RENDERS,
  normalizeWheelDelta,
  previewScaleRatio,
  SCALE_COMMIT_DEBOUNCE_MS,
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
  viewerSlot?: WorkbenchMode
}

export function PdfViewer({
  filePath,
  isActive = true,
  viewerSlot = 'browse'
}: PdfViewerProps): JSX.Element {
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
  /** 预览缩放已调整 scroll，高清提交时按 scroll 比例保留，避免 focal 二次放大 */
  const commitFromPreviewRef = useRef(false)
  const thumbOpenRef = useRef(false)
  const outlineOpenRef = useRef(false)
  const edgeCommitRafRef = useRef<number | null>(null)
  const progressRestoredRef = useRef(false)
  const savedProgressRef = useRef<ReadingProgress | null>(null)

  const showSidebar = useWorkspaceStore((s) => s.showSidebar)
  const showAIPanel = useWorkspaceStore((s) => s.showAIPanel)
  const layoutProfile = layoutZoomProfile(showSidebar, showAIPanel)
  const layoutProfileRef = useRef(layoutProfile)

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

  const { saveProgress, flushProgress, loadProgress, isRestoringRef } = useReadingProgress(
    filePath,
    isActive && !loading
  )

  const patchPdfScale = useCallback(
    (scaleVal: number) =>
      pdfScaleProgressPatch(viewerSlot, layoutProfile, scaleVal, savedProgressRef.current),
    [layoutProfile, viewerSlot]
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

  const invalidateStretchedPreviewSlots = useCallback((): void => {
    pageSlotsRef.current.forEach((slot) => {
      if (slotHasStretchedCanvas(slot)) {
        markSlotNeedsRerender(slot)
      }
    })
  }, [])

  /** 从隐藏槽切到可见时，强制重绘视口内页面（避免 canvas 在 visibility:hidden 下空白） */
  const refreshVisiblePagesOnActivate = useCallback((): void => {
    const container = containerRef.current
    if (!container) return
    pageSlotsRef.current.forEach((slot, pageNo) => {
      if (!isPageNearViewport(slot.wrap, container, 320)) return
      if (slot.rendered || slotHasStretchedCanvas(slot)) {
        markSlotNeedsRerender(slot)
      }
    })
    renderWaitQueueRef.current = []
  }, [])

  const prevActiveRef = useRef(isActive)
  const needsActivateSyncRef = useRef(false)

  const queuePageRender = useCallback(
    (pageNo: number): void => {
      if (!isActiveRef.current || isZoomPreviewRef.current) return
      const slot = pageSlotsRef.current.get(pageNo)
      if (!slot || slot.rendering) return
      if (slotHasStretchedCanvas(slot)) {
        markSlotNeedsRerender(slot)
      }
      if (slot.rendered) return
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

  const clearPagesRootPreviewTransform = useCallback((): void => {
    const root = pagesRootRef.current
    if (!root) return
    root.style.transform = ''
    root.style.transformOrigin = ''
  }, [])

  /** 用 slot 尺寸 + 画布拉伸代替高清重绘，滚轮连续缩放时保持流畅 */
  const applyPreviewLayoutScale = useCallback((targetDisplay: number, prevDisplay: number): void => {
    const container = containerRef.current
    if (!container) return
    const committed = laidOutScaleRef.current ?? scaleRef.current
    if (Math.abs(targetDisplay - committed) < 0.001) {
      for (const slot of Array.from(pageSlotsRef.current.values())) {
        resizeSlotToScale(slot, committed)
        fitStaleCanvasToSlot(slot, committed, committed)
      }
      return
    }
    const containerRect = container.getBoundingClientRect()
    const focal = zoomFocalRef.current ?? {
      clientX: containerRect.left + containerRect.width / 2,
      clientY: containerRect.top + containerRect.height / 2
    }
    const scaleFactor = Math.abs(prevDisplay) > 0.001 ? targetDisplay / prevDisplay : 1
    for (const slot of Array.from(pageSlotsRef.current.values())) {
      resizeSlotToScale(slot, targetDisplay)
      fitStaleCanvasToSlot(slot, targetDisplay, committed)
    }
    if (Math.abs(scaleFactor - 1) > 0.001) {
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
  }, [])

  const flushZoomPreview = useCallback((): void => {
    if (!isZoomPreviewRef.current && scaleCommitTimerRef.current == null) return
    const fromPreview = isZoomPreviewRef.current || scaleCommitTimerRef.current != null
    if (scaleCommitTimerRef.current) {
      clearTimeout(scaleCommitTimerRef.current)
      scaleCommitTimerRef.current = null
    }
    isZoomPreviewRef.current = false
    const committed = clampPdfScale(displayScaleRef.current)
    displayScaleRef.current = committed
    clearPagesRootPreviewTransform()
    setDisplayScale(committed)
    if (Math.abs(committed - scaleRef.current) > 0.001) {
      commitFromPreviewRef.current = fromPreview
      setScale(committed)
    }
  }, [clearPagesRootPreviewTransform])

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
    clearPagesRootPreviewTransform()
    setDisplayScale(committed)
    if (Math.abs(committed - scaleRef.current) > 0.001) {
      setScale(committed)
    } else {
      suppressFocalScrollRef.current = false
    }
    resetPageZoom()
  }, [clearPagesRootPreviewTransform])

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
              ...patchPdfScale(scaleRef.current)
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
    [queuePageRender, ensurePageRendered, saveProgress, isRestoringRef, patchPdfScale]
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

  useReaderNavigate(isActive, (anchor) => {
    if (anchor.pdfPage != null && anchor.pdfPage > 0) {
      scrollToPage(anchor.pdfPage)
      return
    }
    const container = containerRef.current
    if (container && anchor.pdfScrollRatio != null) {
      const max = container.scrollHeight - container.clientHeight
      container.scrollTop = anchor.pdfScrollRatio * Math.max(0, max)
    }
  })

  const applySavedScrollPosition = useCallback(
    (saved: ReadingProgress): void => {
      const container = containerRef.current
      if (!container) return
      isRestoringRef.current = true
      if (saved.pdfScrollRatio != null) {
        const maxScroll = container.scrollHeight - container.clientHeight
        container.scrollTop = saved.pdfScrollRatio * Math.max(0, maxScroll)
      } else if (saved.pdfPage != null && saved.pdfPage > 0) {
        scrollToPage(saved.pdfPage)
      }
      isRestoringRef.current = false
    },
    [scrollToPage, isRestoringRef]
  )

  const storeZoomFocal = useCallback((clientX: number, clientY: number): void => {
    zoomFocalRef.current = { clientX, clientY }
  }, [])

  /** 滚轮缩放：连续滚动时低清预览，停止后再提交 layout scale 并高清重绘 */
  const scheduleScaleCommit = useCallback(
    (nextDisplay: number): void => {
      const clamped = clampPdfScale(nextDisplay)
      if (scaleCommitTimerRef.current) {
        clearTimeout(scaleCommitTimerRef.current)
        scaleCommitTimerRef.current = null
      }

      const panelOpen = thumbOpenRef.current || outlineOpenRef.current
      if (panelOpen) {
        isZoomPreviewRef.current = false
        suppressFocalScrollRef.current = true
        displayScaleRef.current = clamped
        clearPagesRootPreviewTransform()
        setDisplayScale(clamped)
        if (Math.abs(clamped - scaleRef.current) > 0.001) {
          setScale(clamped)
        } else {
          suppressFocalScrollRef.current = false
        }
        requestAnimationFrame(() => resetPageZoom())
        return
      }

      const prevDisplay = displayScaleRef.current
      setDisplayScale(clamped)
      displayScaleRef.current = clamped
      const previewing = isZoomPreviewing(clamped, scaleRef.current)
      isZoomPreviewRef.current = previewing
      if (previewing) {
        applyPreviewLayoutScale(clamped, prevDisplay)
        renderWaitQueueRef.current = []
      } else if (Math.abs(clamped - scaleRef.current) <= 0.001) {
        isZoomPreviewRef.current = false
        if (Math.abs(prevDisplay - clamped) > 0.001) {
          applyPreviewLayoutScale(clamped, prevDisplay)
          invalidateStretchedPreviewSlots()
          requestAnimationFrame(() => bootstrapVisiblePagesRef.current())
        }
        return
      }

      scaleCommitTimerRef.current = setTimeout(() => {
        scaleCommitTimerRef.current = null
        commitFromPreviewRef.current =
          Math.abs(displayScaleRef.current - scaleRef.current) > 0.001
        isZoomPreviewRef.current = false
        clearPagesRootPreviewTransform()
        if (thumbOpenRef.current || outlineOpenRef.current) {
          suppressFocalScrollRef.current = true
        }
        setScale(displayScaleRef.current)
        requestAnimationFrame(() => resetPageZoom())
      }, SCALE_COMMIT_DEBOUNCE_MS)
    },
    [applyPreviewLayoutScale, clearPagesRootPreviewTransform, invalidateStretchedPreviewSlots]
  )

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
    saveProgress({ ...patchPdfScale(scale), pdfPage: currentPage })
  }, [scale, currentPage, layoutReady, saveProgress, isRestoringRef, patchPdfScale])

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
        savedProgressRef.current = saved
        const initialScale = savedPdfScale(saved, viewerSlot, layoutProfileRef.current)
        if (initialScale != null) {
          const next = clampPdfScale(initialScale)
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
  }, [filePath, clearPageSlots, bumpRenderGeneration, viewerSlot])

  useEffect(() => {
    if (isActive && !prevActiveRef.current) {
      needsActivateSyncRef.current = true
    }
    prevActiveRef.current = isActive
  }, [isActive])

  useEffect(() => {
    if (isActive) {
      if (scaleCommitTimerRef.current != null || isZoomPreviewRef.current) {
        flushZoomPreview()
      }
      if (!layoutReady) return

      const runActivateSession = (): void => {
        refreshVisiblePagesOnActivate()
        if (needsActivateSyncRef.current) {
          needsActivateSyncRef.current = false
          void loadProgress().then((saved) => {
            if (!saved || !isActiveRef.current) {
              bootstrapVisiblePagesRef.current()
              return
            }
            applySavedScrollPosition(saved)
            requestAnimationFrame(() => bootstrapVisiblePagesRef.current())
          })
          return
        }
        bootstrapVisiblePagesRef.current()
      }

      requestAnimationFrame(() => runActivateSession())
      return
    }
    if (scaleCommitTimerRef.current != null) {
      clearTimeout(scaleCommitTimerRef.current)
      scaleCommitTimerRef.current = null
    }
    isZoomPreviewRef.current = false
    bumpRenderGeneration()
    renderWaitQueueRef.current = []
    invalidateStretchedPreviewSlots()
  }, [
    isActive,
    layoutReady,
    bumpRenderGeneration,
    flushZoomPreview,
    invalidateStretchedPreviewSlots,
    refreshVisiblePagesOnActivate,
    loadProgress,
    applySavedScrollPosition
  ])

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
    const scrollLeftBefore = container.scrollLeft
    /** 预览阶段已对齐 scroll + slot 尺寸，高清提交只换画布不重算滚动 */
    const skipScrollForPreviewCommit = commitFromPreviewRef.current
    if (commitFromPreviewRef.current) {
      commitFromPreviewRef.current = false
    }

    clearPagesRootPreviewTransform()

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
      if (pendingNav == null && !skipScrollForPreviewCommit) {
        if (suppressFocalScrollRef.current) {
          const maxScroll = container.scrollHeight - container.clientHeight
          container.scrollTop = scrollRatioBefore * Math.max(0, maxScroll)
          container.scrollLeft = scrollLeftBefore
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
  }, [scale, layoutReady, bumpRenderGeneration, clearPagesRootPreviewTransform])

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

  /** 笔记模式分屏后左侧阅读区宽度变化，需重新 bootstrap 可见页 */
  useEffect(() => {
    const container = containerRef.current
    if (!container || !layoutReady || !isActive) return

    let raf = 0
    const ro = new ResizeObserver(() => {
      if (isRestoringRef.current || isZoomPreviewRef.current || isRescalingRef.current) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        refreshVisiblePagesOnActivate()
        bootstrapVisiblePagesRef.current()
      })
    })
    ro.observe(container)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [layoutReady, isActive, refreshVisiblePagesOnActivate])

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
            ...patchPdfScale(scaleRef.current)
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
  }, [layoutReady, saveProgress, isRestoringRef, patchPdfScale])

  useEffect(() => {
    const prev = layoutProfileRef.current
    if (prev === layoutProfile) return

    if (layoutReady && !isRestoringRef.current) {
      const outgoing = pdfScaleProgressPatch(
        viewerSlot,
        prev,
        scaleRef.current,
        savedProgressRef.current
      )
      savedProgressRef.current = {
        ...(savedProgressRef.current ?? { docPath: filePath, updatedAt: '' }),
        ...outgoing
      }
      void flushProgress(outgoing)
    }

    void loadProgress().then((saved) => {
      savedProgressRef.current = saved
      const nextScale = savedPdfScale(saved, viewerSlot, layoutProfile)
      layoutProfileRef.current = layoutProfile
      if (nextScale == null || !layoutReady) return
      isRestoringRef.current = true
      const clamped = clampPdfScale(nextScale)
      if (Math.abs(clamped - scaleRef.current) <= 0.001) {
        isRestoringRef.current = false
        return
      }
      scaleRef.current = clamped
      displayScaleRef.current = clamped
      isZoomPreviewRef.current = false
      if (scaleCommitTimerRef.current) {
        clearTimeout(scaleCommitTimerRef.current)
        scaleCommitTimerRef.current = null
      }
      setScale(clamped)
      setDisplayScale(clamped)
      requestAnimationFrame(() => {
        isRestoringRef.current = false
      })
    })
  }, [
    filePath,
    flushProgress,
    layoutProfile,
    layoutReady,
    loadProgress,
    viewerSlot
  ])

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
      if (scaleCommitTimerRef.current != null) {
        clearTimeout(scaleCommitTimerRef.current)
        scaleCommitTimerRef.current = null
      }
    }
  }, [scheduleScaleCommit, storeZoomFocal, layoutReady])

  const closeToolbar = useCallback((): void => {
    setToolbarRect(null)
    setPendingText('')
    clearDomSelection()
  }, [clearDomSelection])

  const showViewer = !loading && !error && pageCount > 0 && layoutReady
  const showLoading = loading || (pageCount > 0 && !layoutReady)
  const sidePanelOpen = thumbOpen || outlineOpen
  const isPreviewingZoom =
    previewScaleRatio(displayScale, scale) !== 1 && !sidePanelOpen && !isRescaling

  return (
    <div ref={wrapperRef} className="pdf-wrapper">
      <div className="pdf-toolbar">
        <IconButton icon={ZoomOut} label="缩小" onClick={() => adjustZoom(-WHEEL_ZOOM_STEP)} />
        <span>{Math.round(displayScale * 100)}%</span>
        <IconButton icon={ZoomIn} label="放大" onClick={() => adjustZoom(WHEEL_ZOOM_STEP)} />
        <span style={{ marginLeft: 16 }}>
          第 {currentPage} / {pageCount} 页
        </span>
        {pageCount > 0 && renderedCount < pageCount && !isRescaling && !isPreviewingZoom && (
          <span className="pdf-render-progress">高清渲染 {renderedCount}/{pageCount}</span>
        )}
        {isPreviewingZoom && (
          <span className="pdf-render-progress">缩放预览</span>
        )}
        {isRescaling && (
          <span className="pdf-render-progress">缩放重绘中…</span>
        )}
      </div>

      {showLoading && <div className="loading-state">正在打开 PDF...</div>}
      {error && <div className="error-state">{error}</div>}

      <div
        ref={shellRef}
        className={`pdf-viewer-shell${showViewer ? '' : ' pdf-viewer-shell--hidden'}`}
      >
        <div ref={containerRef} className={`pdf-viewer${isRescaling ? ' pdf-rescaling' : ''}`}>
          <div ref={pagesRootRef} className="pdf-pages-root">
            <div ref={pagesContentRef} className="pdf-pages-content" />
          </div>
        </div>

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
