import { StickyNote, ZoomIn, ZoomOut } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toUint8Array } from '@shared/binary'
import { IconButton } from '../../../components/IconButton'
import { useAnnotationSurface } from '../annotations/AnnotationSurfaceContext'
import { NoteInputModal, SelectionToolbar } from '../annotations/SelectionToolbar'
import { resolveMarkupColor } from '../annotations/annotationMarkup'
import { applyDomAnnotation, refreshTextMarkup, scrollToAnnotationText } from '../annotations/textUtils'
import { useAnnotations } from '../annotations/useAnnotations'
import { useDomSelectionEffect } from '../annotations/useDomSelectionEffect'
import { useDomTextSelection } from '../annotations/useDomTextSelection'
import { ANNOTATION_SURFACE_RESIZE_EVENT } from '../annotations/shapeUtils'
import { useDomAnnotationToolUndo } from '../annotations/useAnnotationToolUndo'
import { useDomFind } from '../find/useDomFind'
import { useViewerCommand } from '../find/useViewerCommand'
import { selectAllInElement } from '../find/domFind'
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
  computePagesRootTransformOrigin,
  computeZoomFocalScroll,
  isZoomPreviewing,
  LAZY_ROOT_MARGIN,
  MAX_CONCURRENT_PAGE_RENDERS,
  previewScaleRatio,
  SCALE_COMMIT_DEBOUNCE_MS,
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
  const pagesRootRef = useRef<HTMLDivElement>(null)
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
  const annotationsAppliedRef = useRef<Set<number>>(new Set())
  const progressRestoredRef = useRef(false)

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
  const [pendingAnchor, setPendingAnchor] = useState<{
    page: number
    x: number
    y: number
  } | null>(null)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const [showTextNoteModal, setShowTextNoteModal] = useState(false)
  const [scrollSurface, setScrollSurface] = useState<HTMLDivElement | null>(null)
  const [zoomTransformOrigin, setZoomTransformOrigin] = useState('top center')
  const [outlineItems, setOutlineItems] = useState<PdfOutlineItem[]>([])
  const [outlineLoading, setOutlineLoading] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [thumbOpen, setThumbOpen] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)

  const { saveProgress, loadProgress, isRestoringRef } = useReadingProgress(
    filePath,
    isActive && !loading
  )

  scaleRef.current = scale
  displayScaleRef.current = displayScale
  currentPageRef.current = currentPage

  const previewRatio = previewScaleRatio(displayScale, scale)

  useAnnotationSurface(scrollSurface)

  const { annotations, create, remove } = useAnnotations(filePath, isActive && !loading)
  const {
    focusAnnotationId,
    setFocusAnnotationId,
    annotationTool,
    sendToAI,
    setSelection,
    setAnnotationTool
  } = useWorkspaceStore()
  const pdfNotes = useMemo(
    () => annotations.filter((a) => a.type === 'note' && a.pdfAnchor),
    [annotations]
  )
  const textAnnotations = useMemo(
    () =>
      annotations.filter(
        (a) => (a.type === 'highlight' || a.type === 'underline') && a.selectedText
      ),
    [annotations]
  )
  const textAnnotationsRef = useRef(textAnnotations)
  textAnnotationsRef.current = textAnnotations

  const drawTool =
    annotationTool === 'pen' || annotationTool === 'rect' || annotationTool === 'eraser'
  const placementNoteMode = annotationTool === 'note'
  const textSelectEnabled =
    isActive && !placementNoteMode && !loading && pageCount > 0 && !drawTool
  const { selection: domSelection, clearSelection: clearDomSelection } = useDomTextSelection(
    filePath,
    containerRef,
    textSelectEnabled
  )
  useDomAnnotationToolUndo(annotations, remove, containerRef, isActive && !loading)
  useDomFind(containerRef.current, isActive && !loading)
  useViewerCommand(isActive && !loading, 'selectAll', () => selectAllInElement(containerRef.current))

  const clearPageSlots = useCallback((): void => {
    pageSlotsRef.current.forEach((slot) => destroyPageSlot(slot))
    pageSlotsRef.current.clear()
    textLayersRef.current.forEach((h) => h.destroy())
    textLayersRef.current = []
    renderWaitQueueRef.current = []
    activeRenderCountRef.current = 0
    annotationsAppliedRef.current.clear()
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

      refreshTextMarkup(slot.wrap, textAnnotationsRef.current)
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

  const scrollToPage = useCallback(
    (pageNo: number): void => {
      if (pageNo < 1 || pageCount <= 0 || pageNo > pageCount) return
      queuePageRender(pageNo)
      const generation = renderGenerationRef.current

      const applyScroll = (): boolean => {
        const root = containerRef.current
        const pageEl = root?.querySelector<HTMLElement>(`.pdf-page-wrap[data-page="${pageNo}"]`)
        if (!pageEl || !root) return false
        pageEl.scrollIntoView({ behavior: 'auto', block: 'start' })
        currentPageRef.current = pageNo
        setCurrentPage(pageNo)
        if (!isRestoringRef.current) {
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
    [pageCount, queuePageRender, ensurePageRendered, saveProgress, isRestoringRef]
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

  const notifyAnnotationLayout = useCallback((): void => {
    pagesRootRef.current?.dispatchEvent(new Event(ANNOTATION_SURFACE_RESIZE_EVENT))
  }, [])

  const resolveZoomOrigin = useCallback((clientX: number, clientY: number): string => {
    const container = containerRef.current
    const pagesRoot = pagesRootRef.current
    if (!container || !pagesRoot) return 'top center'
    const containerRect = container.getBoundingClientRect()
    return computePagesRootTransformOrigin(
      clientX,
      clientY,
      container.scrollLeft,
      container.scrollTop,
      containerRect,
      pagesRoot.offsetLeft,
      pagesRoot.offsetTop
    )
  }, [])

  const storeZoomFocal = useCallback((clientX: number, clientY: number): void => {
    zoomFocalRef.current = { clientX, clientY }
  }, [])

  const scheduleScaleCommit = useCallback(
    (nextDisplay: number, transformOrigin?: string): void => {
      const clamped = clampPdfScale(nextDisplay)
      if (transformOrigin) setZoomTransformOrigin(transformOrigin)
      setDisplayScale(clamped)
      displayScaleRef.current = clamped
      const previewing = isZoomPreviewing(clamped, scaleRef.current)
      isZoomPreviewRef.current = previewing
      if (previewing) {
        renderWaitQueueRef.current = []
      }
      if (scaleCommitTimerRef.current) clearTimeout(scaleCommitTimerRef.current)
      scaleCommitTimerRef.current = setTimeout(() => {
        scaleCommitTimerRef.current = null
        isZoomPreviewRef.current = false
        setScale(displayScaleRef.current)
      }, SCALE_COMMIT_DEBOUNCE_MS)
      requestAnimationFrame(() => notifyAnnotationLayout())
    },
    [notifyAnnotationLayout]
  )

  const adjustZoom = useCallback(
    (delta: number): void => {
      const container = containerRef.current
      if (!container) {
        scheduleScaleCommit(displayScaleRef.current + delta)
        return
      }
      const rect = container.getBoundingClientRect()
      const clientX = rect.left + rect.width / 2
      const clientY = rect.top + rect.height / 2
      storeZoomFocal(clientX, clientY)
      scheduleScaleCommit(displayScaleRef.current + delta, resolveZoomOrigin(clientX, clientY))
    },
    [scheduleScaleCommit, resolveZoomOrigin, storeZoomFocal]
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
          container
            .querySelector(`.pdf-page-wrap[data-page="${saved.pdfPage}"]`)
            ?.scrollIntoView({ block: 'start' })
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
    setScrollSurface(pagesRootRef.current)
  }, [loading, pageCount, layoutReady])

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
      annotationsAppliedRef.current.clear()

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
    const pagesRoot = pagesRootRef.current
    if (!pdf || !pagesRoot || loading || pageCount === 0) return

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
        annotationsAppliedRef.current.clear()
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
        pagesRoot.replaceChildren(frag)

        if (cancelled || generation !== renderGenerationRef.current) return
        laidOutScaleRef.current = layoutScale
        setLayoutReady(true)
        requestAnimationFrame(() => {
          if (!cancelled && generation === renderGenerationRef.current) {
            bootstrapVisiblePagesRef.current()
            notifyAnnotationLayout()
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
  }, [filePath, loading, pageCount, bumpRenderGeneration, notifyAnnotationLayout])

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

    annotationsAppliedRef.current.clear()

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

    container.classList.add('pdf-rescaling')

    requestAnimationFrame(() => {
      if (cancelled) return
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
      bootstrapVisiblePagesRef.current()
      container.classList.remove('pdf-rescaling')
      notifyAnnotationLayout()
    })

    return () => {
      cancelled = true
      container.classList.remove('pdf-rescaling')
    }
  }, [scale, layoutReady, bumpRenderGeneration, notifyAnnotationLayout])

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
    pageSlotsRef.current.forEach((slot) => {
      if (!slot.rendered) return
      refreshTextMarkup(slot.wrap, textAnnotations)
    })
  }, [textAnnotations, layoutReady])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateCurrentPage = (): void => {
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
        if (c && !isRestoringRef.current) {
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
      if (!e.ctrlKey) return
      e.preventDefault()

      wheelAccumRef.current.deltaY += e.deltaY
      wheelAccumRef.current.deltaMode = e.deltaMode
      wheelAccumRef.current.clientX = e.clientX
      wheelAccumRef.current.clientY = e.clientY

      if (wheelRafRef.current != null) return
      wheelRafRef.current = requestAnimationFrame(() => {
        wheelRafRef.current = null
        const acc = wheelAccumRef.current
        wheelAccumRef.current = { deltaY: 0, deltaMode: 0, clientX: 0, clientY: 0 }

        const next = applyWheelZoom(displayScaleRef.current, acc.deltaY, acc.deltaMode)
        if (Math.abs(next - displayScaleRef.current) < 0.0001) return

        storeZoomFocal(acc.clientX, acc.clientY)
        const origin = resolveZoomOrigin(acc.clientX, acc.clientY)
        scheduleScaleCommit(next, origin)
      })
    }
    const el = containerRef.current
    el?.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el?.removeEventListener('wheel', handleWheel)
      if (scaleCommitTimerRef.current) clearTimeout(scaleCommitTimerRef.current)
      if (wheelRafRef.current != null) cancelAnimationFrame(wheelRafRef.current)
    }
  }, [scheduleScaleCommit, resolveZoomOrigin, storeZoomFocal])

  useEffect(() => {
    if (!focusAnnotationId) return
    const ann = annotations.find((a) => a.id === focusAnnotationId)
    if (!ann) {
      setFocusAnnotationId(null)
      return
    }

    if (ann.pdfAnchor) {
      setExpandedNoteId(ann.id)
      const generation = renderGenerationRef.current
      void ensurePageRendered(ann.pdfAnchor.page, generation).then(() => {
        containerRef.current
          ?.querySelector(`.pdf-page-wrap[data-page="${ann.pdfAnchor!.page}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      setFocusAnnotationId(null)
      return
    }

    if (ann.selectedText && containerRef.current) {
      scrollToAnnotationText(containerRef.current, ann.selectedText)
    }
    setFocusAnnotationId(null)
  }, [focusAnnotationId, annotations, setFocusAnnotationId, ensurePageRendered])

  useEffect(() => {
    const container = containerRef.current
    if (!container || loading) return

    container.querySelectorAll('.pdf-pin').forEach((el) => el.remove())

    pdfNotes.forEach((note) => {
      if (!note.pdfAnchor) return
      const pageNo = note.pdfAnchor.page
      const generation = renderGenerationRef.current
      void ensurePageRendered(pageNo, generation).then(() => {
        const pageWrap = container.querySelector<HTMLElement>(
          `.pdf-page-wrap[data-page="${pageNo}"]`
        )
        if (!pageWrap) return

        const pin = document.createElement('div')
        pin.className = `pdf-pin ${expandedNoteId === note.id ? 'open' : ''}`
        pin.style.left = `${note.pdfAnchor!.x * 100}%`
        pin.style.top = `${note.pdfAnchor!.y * 100}%`
        pin.textContent = '📌'
        pin.onclick = (e) => {
          e.stopPropagation()
          setExpandedNoteId((id) => (id === note.id ? null : note.id))
        }

        if (expandedNoteId === note.id) {
          const popup = document.createElement('div')
          popup.className = 'pdf-pin-popup'
          popup.innerHTML = `<p>${note.content || '（无内容）'}</p>`
          pin.appendChild(popup)
        }

        pageWrap.appendChild(pin)
      })
    })
  }, [loading, pdfNotes, expandedNoteId, ensurePageRendered])

  const closeToolbar = useCallback((): void => {
    setToolbarRect(null)
    setPendingText('')
    clearDomSelection()
  }, [clearDomSelection])

  const saveAnnotation = useCallback(
    async (
      type: 'highlight' | 'underline' | 'note',
      noteContent?: string,
      override?: { text?: string; domRange?: Range | null }
    ): Promise<void> => {
      const text = override?.text ?? pendingText
      if (!text) return

      if (type === 'note') {
        if (!noteContent) return
        await create({
          type: 'note',
          color: resolveMarkupColor('note'),
          content: noteContent,
          selectedText: text
        })
        setShowTextNoteModal(false)
        closeToolbar()
        return
      }

      const domRange = override?.domRange ?? null
      const color = resolveMarkupColor(type)
      const targetRoot = domRange
        ? (domRange.commonAncestorContainer as Node).nodeType === Node.ELEMENT_NODE
          ? ((domRange.commonAncestorContainer as Element).closest('.pdf-page-wrap') as
              | HTMLElement
              | null)
          : (domRange.commonAncestorContainer.parentElement?.closest('.pdf-page-wrap') as
              | HTMLElement
              | null)
        : null
      if (targetRoot) {
        applyDomAnnotation(targetRoot, type, text, domRange, color)
      } else if (containerRef.current) {
        applyDomAnnotation(containerRef.current, type, text, domRange, color)
      }
      await create({
        type,
        color,
        selectedText: text
      })
      closeToolbar()
    },
    [create, pendingText, closeToolbar]
  )

  useDomSelectionEffect({
    domSelection,
    clearSelection: clearDomSelection,
    annotationTool,
    setSelection,
    setPendingText,
    setToolbarRect,
    setShowNoteModal: setShowTextNoteModal,
    saveAnnotation
  })

  const handlePageClick = (e: React.MouseEvent): void => {
    if (!placementNoteMode) return
    const target = (e.target as HTMLElement).closest('.pdf-page-wrap') as HTMLElement | null
    if (!target) return
    const page = Number(target.dataset.page)
    const rect = target.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setPendingAnchor({ page, x, y })
  }

  const savePdfNote = async (content: string): Promise<void> => {
    if (!pendingAnchor) return
    await create({
      type: 'note',
      color: resolveMarkupColor('note'),
      content,
      pdfAnchor: pendingAnchor
    })
    setPendingAnchor(null)
    setAnnotationTool('select')
  }

  const showViewer = !loading && !error && pageCount > 0 && layoutReady
  const showLoading = loading || (pageCount > 0 && !layoutReady)
  const isPreviewingZoom = previewRatio !== 1

  return (
    <div ref={wrapperRef} className="pdf-wrapper">
      <div className="pdf-toolbar">
        <IconButton icon={ZoomOut} label="缩小" onClick={() => adjustZoom(-WHEEL_ZOOM_STEP)} />
        <span>{Math.round(displayScale * 100)}%</span>
        <IconButton icon={ZoomIn} label="放大" onClick={() => adjustZoom(WHEEL_ZOOM_STEP)} />
        <span style={{ marginLeft: 16 }}>
          第 {currentPage} / {pageCount} 页
        </span>
        {pageCount > 0 && renderedCount < pageCount && !isPreviewingZoom && (
          <span className="pdf-render-progress">高清渲染 {renderedCount}/{pageCount}</span>
        )}
        {isPreviewingZoom && (
          <span className="pdf-render-progress">缩放预览</span>
        )}
        <IconButton
          icon={StickyNote}
          label={placementNoteMode ? '点击页面添加便签' : '添加便签'}
          className={`pdf-note-btn ${placementNoteMode ? 'active' : ''}`}
          active={placementNoteMode}
          onClick={() => setAnnotationTool(placementNoteMode ? 'select' : 'note')}
        />
      </div>

      {showLoading && <div className="loading-state">正在打开 PDF...</div>}
      {error && <div className="error-state">{error}</div>}

      <div className="pdf-viewer-shell" style={{ display: showViewer ? 'flex' : 'none' }}>
        <PdfSideHover
          side="left"
          open={outlineOpen}
          setOpen={setOutlineOpen}
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
          setOpen={setThumbOpen}
          label="缩略图"
        >
          <PdfThumbnailPanel
            pdf={pdfReady ? pdfDocRef.current : null}
            pageCount={pageCount}
            currentPage={currentPage}
            onNavigate={scrollToPage}
          />
        </PdfSideHover>

        <div
          ref={containerRef}
          className={`pdf-viewer${placementNoteMode ? ' note-mode' : ''}${
            isPreviewingZoom ? ' pdf-zoom-preview' : ''
          }`}
          onClick={handlePageClick}
        >
          <div
            ref={pagesRootRef}
            className="pdf-pages-root"
            style={
              isPreviewingZoom
                ? { transform: `scale(${previewRatio})`, transformOrigin: zoomTransformOrigin }
                : undefined
            }
          />
        </div>
      </div>

      {toolbarRect && annotationTool === 'select' && (
        <SelectionToolbar
          rect={toolbarRect}
          onHighlight={() => void saveAnnotation('highlight')}
          onUnderline={() => void saveAnnotation('underline')}
          onNote={() => setShowTextNoteModal(true)}
          onAskAI={() => {
            sendToAI(pendingText, filePath)
            closeToolbar()
          }}
          onClose={closeToolbar}
        />
      )}

      {pendingAnchor && (
        <NoteInputModal
          onSubmit={savePdfNote}
          onCancel={() => {
            setPendingAnchor(null)
            setAnnotationTool('select')
          }}
        />
      )}

      {showTextNoteModal && (
        <NoteInputModal
          onSubmit={(content) => void saveAnnotation('note', content)}
          onCancel={() => setShowTextNoteModal(false)}
        />
      )}
    </div>
  )
}
