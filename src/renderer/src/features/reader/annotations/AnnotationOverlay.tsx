import { useCallback, useEffect, useRef, useState } from 'react'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import type { Annotation, DrawShape, ShapePoint } from '../../../types/global.d'
import {
  ANNOTATION_SURFACE_RESIZE_EVENT,
  clientToContentPoint,
  getContentElement,
  getContentSize,
  getScrollContainer,
  hitTestAnnotation,
  normalizeRect,
  shapeToPixels
} from './shapeUtils'
import { annotationCreateInput, findLastAnnotationByType, toolUsesRightClickUndo } from './annotationToolUtils'
import { useAnnotations } from './useAnnotations'

interface AnnotationOverlayProps {
  docPath: string
  isActive: boolean
  surface: HTMLElement
}

interface DraftPen {
  kind: 'pen'
  points: ShapePoint[]
}

interface DraftRect {
  kind: 'rect'
  start: ShapePoint
  end: ShapePoint
}

type Draft = DraftPen | DraftRect

const IGNORE_DRAW_TARGETS =
  '.annotation-toolbar, .selection-toolbar, .note-input-modal, .global-search-bar, .document-find-bar, .titlebar, .tab-bar, .pdf-toolbar, .pdf-side-hover, .pdf-side-panel, .pdf-side-trigger, .pdf-outline-item, .pdf-thumb-item'

function isIgnorableDrawTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !!target.closest(IGNORE_DRAW_TARGETS)
}

function isWithinSurface(clientX: number, clientY: number, surface: HTMLElement): boolean {
  const rect = getContentElement(surface).getBoundingClientRect()
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  )
}

function renderAnnotation(
  annotation: Annotation,
  width: number,
  height: number,
  focused: boolean
): JSX.Element | null {
  if (!annotation.shape) return null
  const scaled = shapeToPixels(annotation.shape, width, height)
  const stroke = annotation.color
  const opacity = focused ? 1 : 0.85

  if (annotation.type === 'pen' && scaled.points && scaled.points.length > 0) {
    const d = scaled.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    return (
      <path
        key={annotation.id}
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={scaled.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
    )
  }

  if (annotation.type === 'rect' && scaled.width != null && scaled.height != null) {
    return (
      <rect
        key={annotation.id}
        x={scaled.x}
        y={scaled.y}
        width={scaled.width}
        height={scaled.height}
        fill="none"
        stroke={stroke}
        strokeWidth={scaled.strokeWidth}
        opacity={opacity}
      />
    )
  }

  return null
}

export function AnnotationOverlay({
  docPath,
  isActive,
  surface
}: AnnotationOverlayProps): JSX.Element {
  const [size, setSize] = useState(() => getContentSize(surface))
  const [draft, setDraft] = useState<Draft | null>(null)
  const drawingRef = useRef(false)
  const draftRef = useRef<Draft | null>(null)
  const eraserUndoStackRef = useRef<Annotation[]>([])
  const activePointerIdRef = useRef<number | null>(null)

  const { annotations, create, remove } = useAnnotations(docPath, isActive)
  const annotationTool = useWorkspaceStore((s) => s.annotationTool)
  const annotationColor = useWorkspaceStore((s) => s.annotationColor)
  const annotationStrokeWidth = useWorkspaceStore((s) => s.annotationStrokeWidth)
  const focusAnnotationId = useWorkspaceStore((s) => s.focusAnnotationId)
  const setFocusAnnotationId = useWorkspaceStore((s) => s.setFocusAnnotationId)

  const drawAnnotations = annotations.filter((a) => a.type === 'pen' || a.type === 'rect')
  const drawAnnotationsRef = useRef(drawAnnotations)
  const annotationsRef = useRef(annotations)
  const savePenRef = useRef<(points: ShapePoint[]) => Promise<void>>(async () => {})
  const saveRectRef = useRef<(start: ShapePoint, end: ShapePoint) => Promise<void>>(async () => {})
  const annotationToolRef = useRef(annotationTool)
  drawAnnotationsRef.current = drawAnnotations
  annotationsRef.current = annotations
  annotationToolRef.current = annotationTool

  const applyDraft = useCallback((next: Draft | null) => {
    draftRef.current = next
    setDraft(next)
  }, [])

  const isPdfRescaling = surface.closest('.pdf-rescaling') != null
  const interactive =
    isActive &&
    !isPdfRescaling &&
    (annotationTool === 'pen' || annotationTool === 'rect' || annotationTool === 'eraser')

  const updateSize = useCallback(() => {
    setSize(getContentSize(surface))
  }, [surface])

  useEffect(() => {
    if (isActive) updateSize()
  }, [isActive, updateSize])

  useEffect(() => {
    if (interactive) updateSize()
  }, [interactive, updateSize])

  useEffect(() => {
    updateSize()
    surface.classList.add('annotation-surface')
    const scrollEl = getScrollContainer(surface)
    const ro = new ResizeObserver(updateSize)
    ro.observe(surface)
    const mo = new MutationObserver(updateSize)
    mo.observe(surface, { childList: true, subtree: true, attributes: true })
    scrollEl.addEventListener('scroll', updateSize, { passive: true })
    surface.addEventListener(ANNOTATION_SURFACE_RESIZE_EVENT, updateSize)
    window.addEventListener('resize', updateSize)
    return () => {
      surface.classList.remove('annotation-surface')
      ro.disconnect()
      mo.disconnect()
      scrollEl.removeEventListener('scroll', updateSize)
      surface.removeEventListener(ANNOTATION_SURFACE_RESIZE_EVENT, updateSize)
      window.removeEventListener('resize', updateSize)
    }
  }, [surface, updateSize])

  useEffect(() => {
    if (!focusAnnotationId || !isActive) return
    const ann = annotations.find(
      (a) => a.id === focusAnnotationId && (a.type === 'pen' || a.type === 'rect')
    )
    if (!ann?.shape) return

    const scrollEl = getScrollContainer(surface)
    const { width, height } = getContentSize(surface)
    const scaled = shapeToPixels(ann.shape, width, height)

    let cx: number
    let cy: number
    if (scaled.points?.length) {
      cx = scaled.points.reduce((sum, p) => sum + p.x, 0) / scaled.points.length
      cy = scaled.points.reduce((sum, p) => sum + p.y, 0) / scaled.points.length
    } else {
      cx = (scaled.x ?? 0) + (scaled.width ?? 0) / 2
      cy = (scaled.y ?? 0) + (scaled.height ?? 0) / 2
    }

    scrollEl.scrollTo({
      left: Math.max(0, cx - scrollEl.clientWidth / 2),
      top: Math.max(0, cy - scrollEl.clientHeight / 2),
      behavior: 'smooth'
    })
    setFocusAnnotationId(null)
  }, [annotations, focusAnnotationId, isActive, setFocusAnnotationId, surface])

  const savePen = useCallback(
    async (points: ShapePoint[]): Promise<void> => {
      if (points.length === 0) return
      if (points.length === 1) {
        const p = points[0]
        points = [p, { x: p.x + 0.0005, y: p.y + 0.0005 }]
      }
      const shape: DrawShape = { points, strokeWidth: annotationStrokeWidth }
      await create({ type: 'pen', color: annotationColor, shape })
    },
    [annotationColor, annotationStrokeWidth, create]
  )

  const saveRect = useCallback(
    async (start: ShapePoint, end: ShapePoint): Promise<void> => {
      const rect = normalizeRect(start, end)
      if (rect.width < 0.001 && rect.height < 0.001) return
      const shape: DrawShape = { ...rect, strokeWidth: annotationStrokeWidth }
      await create({ type: 'rect', color: annotationColor, shape })
    },
    [annotationColor, annotationStrokeWidth, create]
  )

  savePenRef.current = savePen
  saveRectRef.current = saveRect

  useEffect(() => {
    if (!interactive) return

    const releaseActiveCapture = (): void => {
      const pointerId = activePointerIdRef.current
      if (pointerId == null) return
      activePointerIdRef.current = null
      try {
        if (surface.hasPointerCapture(pointerId)) {
          surface.releasePointerCapture(pointerId)
        }
      } catch {
        /* pointer 可能已释放 */
      }
    }

    const stopWindowTracking = (): void => {
      window.removeEventListener('pointermove', onPointerMove, true)
      window.removeEventListener('pointerup', onWindowPointerUp, true)
      window.removeEventListener('pointercancel', onWindowPointerUp, true)
      releaseActiveCapture()
    }

    const onPointerMove = (e: PointerEvent): void => {
      if (!drawingRef.current) return
      const point = clientToContentPoint(e.clientX, e.clientY, surface)
      setDraft((prev) => {
        if (!prev) return prev
        const next =
          prev.kind === 'pen'
            ? { kind: 'pen' as const, points: [...prev.points, point] }
            : { kind: 'rect' as const, start: prev.start, end: point }
        draftRef.current = next
        return next
      })
    }

    const finishDraw = (): void => {
      if (!drawingRef.current) return
      drawingRef.current = false
      stopWindowTracking()
      const current = draftRef.current
      applyDraft(null)
      if (!current) return
      if (current.kind === 'pen') {
        void savePenRef.current(current.points)
      } else {
        void saveRectRef.current(current.start, current.end)
      }
    }

    const onWindowPointerUp = (): void => {
      finishDraw()
    }

    const onPointerDown = (e: PointerEvent): void => {
      if (e.button !== 0) return
      if (isIgnorableDrawTarget(e.target)) return
      if (!isWithinSurface(e.clientX, e.clientY, surface)) return

      const tool = annotationToolRef.current
      if (tool === 'eraser') {
        e.preventDefault()
        e.stopPropagation()
        window.getSelection()?.removeAllRanges()
        const hit = [...drawAnnotationsRef.current]
          .reverse()
          .find((a) => hitTestAnnotation(a, e.clientX, e.clientY, surface))
        if (hit) {
          eraserUndoStackRef.current.push(hit)
          void remove(hit.id)
        }
        return
      }

      if (tool !== 'pen' && tool !== 'rect') return
      if (drawingRef.current) return

      e.preventDefault()
      e.stopPropagation()
      drawingRef.current = true
      activePointerIdRef.current = e.pointerId
      try {
        surface.setPointerCapture(e.pointerId)
      } catch {
        /* 少数环境不支持 capture，仍依赖 window 监听 */
      }
      const point = clientToContentPoint(e.clientX, e.clientY, surface)

      if (tool === 'pen') {
        applyDraft({ kind: 'pen', points: [point] })
      } else {
        applyDraft({ kind: 'rect', start: point, end: point })
      }

      window.addEventListener('pointermove', onPointerMove, true)
      window.addEventListener('pointerup', onWindowPointerUp, true)
      window.addEventListener('pointercancel', onWindowPointerUp, true)
    }

    const onContextMenu = (e: MouseEvent): void => {
      if (!isWithinSurface(e.clientX, e.clientY, surface)) return
      const tool = useWorkspaceStore.getState().annotationTool
      if (!toolUsesRightClickUndo(tool)) return
      if (tool !== 'pen' && tool !== 'rect' && tool !== 'eraser') return
      e.preventDefault()

      if ((tool === 'pen' || tool === 'rect') && drawingRef.current) {
        drawingRef.current = false
        stopWindowTracking()
        applyDraft(null)
        return
      }

      if (tool === 'pen' || tool === 'rect') {
        const last = findLastAnnotationByType(annotationsRef.current, tool)
        if (last) void remove(last.id)
        return
      }

      const restored = eraserUndoStackRef.current.pop()
      if (restored) void create(annotationCreateInput(restored))
    }

    const onSelectStart = (e: Event): void => {
      e.preventDefault()
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    surface.addEventListener('contextmenu', onContextMenu)
    surface.addEventListener('selectstart', onSelectStart)

    return () => {
      stopWindowTracking()
      drawingRef.current = false
      window.removeEventListener('pointerdown', onPointerDown, true)
      surface.removeEventListener('contextmenu', onContextMenu)
      surface.removeEventListener('selectstart', onSelectStart)
    }
  }, [interactive, applyDraft, remove, create, surface])

  useEffect(() => {
    if (!interactive) return
    surface.classList.add('annotation-drawing-surface')
    if (annotationTool === 'eraser') {
      surface.classList.add('annotation-eraser-surface')
    }
    return () => {
      surface.classList.remove('annotation-drawing-surface', 'annotation-eraser-surface')
    }
  }, [interactive, annotationTool, surface])

  const draftElement = ((): JSX.Element | null => {
    if (!draft || size.width <= 0 || size.height <= 0) return null

    if (draft.kind === 'pen' && draft.points.length > 0) {
      const scaled = shapeToPixels(
        { points: draft.points, strokeWidth: annotationStrokeWidth },
        size.width,
        size.height
      )
      const d =
        scaled.points?.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') ?? ''
      return (
        <path
          d={d}
          fill="none"
          stroke={annotationColor}
          strokeWidth={annotationStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
      )
    }

    if (draft.kind === 'rect') {
      const rect = normalizeRect(draft.start, draft.end)
      const scaled = shapeToPixels(
        { ...rect, strokeWidth: annotationStrokeWidth },
        size.width,
        size.height
      )
      return (
        <rect
          x={scaled.x}
          y={scaled.y}
          width={scaled.width}
          height={scaled.height}
          fill="none"
          stroke={annotationColor}
          strokeWidth={annotationStrokeWidth}
          opacity={0.9}
        />
      )
    }

    return null
  })()

  const overlayClass = [
    'annotation-overlay-layer',
    interactive ? 'annotation-overlay-interactive' : '',
    interactive && annotationTool === 'eraser' ? 'annotation-overlay-eraser' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <svg
      className={overlayClass}
      style={{ left: 0, top: 0, width: size.width, height: size.height }}
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      aria-hidden
    >
      {drawAnnotations.map((a) =>
        renderAnnotation(a, size.width, size.height, a.id === focusAnnotationId)
      )}
      {draftElement}
    </svg>
  )
}
