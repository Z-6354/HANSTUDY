import { useCallback, useEffect, useRef, useState } from 'react'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import type { Annotation, DrawShape, ShapePoint } from '../../../types/global.d'
import {
  ANNOTATION_SURFACE_RESIZE_EVENT,
  clientToContentPoint,
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

  const { annotations, create, remove } = useAnnotations(docPath, isActive)
  const { annotationTool, annotationColor, annotationStrokeWidth, focusAnnotationId, setFocusAnnotationId } =
    useWorkspaceStore()

  const drawAnnotations = annotations.filter((a) => a.type === 'pen' || a.type === 'rect')
  const isZoomPreview = surface.closest('.pdf-zoom-preview') != null
  const interactive =
    isActive &&
    !isZoomPreview &&
    (annotationTool === 'pen' || annotationTool === 'rect' || annotationTool === 'eraser')

  const updateSize = useCallback(() => {
    setSize(getContentSize(surface))
  }, [surface])

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
    return () => {
      surface.classList.remove('annotation-surface')
      ro.disconnect()
      mo.disconnect()
      scrollEl.removeEventListener('scroll', updateSize)
      surface.removeEventListener(ANNOTATION_SURFACE_RESIZE_EVENT, updateSize)
    }
  }, [surface, updateSize])

  useEffect(() => {
    if (!focusAnnotationId || !isActive) return
    const ann = drawAnnotations.find((a) => a.id === focusAnnotationId)
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
  }, [drawAnnotations, focusAnnotationId, isActive, setFocusAnnotationId, surface])

  const savePen = useCallback(
    async (points: ShapePoint[]): Promise<void> => {
      if (points.length < 2) return
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

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    if (!interactive) return

    const onSelectStart = (e: Event): void => {
      e.preventDefault()
    }

    const onPointerDown = (e: PointerEvent): void => {
      if (e.button !== 0) return

      if (annotationTool === 'eraser') {
        e.preventDefault()
        window.getSelection()?.removeAllRanges()
        const hit = [...drawAnnotations]
          .reverse()
          .find((a) => hitTestAnnotation(a, e.clientX, e.clientY, surface))
        if (hit) {
          eraserUndoStackRef.current.push(hit)
          void remove(hit.id)
        }
        return
      }

      e.preventDefault()
      surface.setPointerCapture(e.pointerId)
      drawingRef.current = true
      const point = clientToContentPoint(e.clientX, e.clientY, surface)

      if (annotationTool === 'pen') {
        setDraft({ kind: 'pen', points: [point] })
      } else if (annotationTool === 'rect') {
        setDraft({ kind: 'rect', start: point, end: point })
      }
    }

    const onPointerMove = (e: PointerEvent): void => {
      if (!drawingRef.current) return
      const current = draftRef.current
      if (!current) return
      const point = clientToContentPoint(e.clientX, e.clientY, surface)

      if (current.kind === 'pen') {
        setDraft({ kind: 'pen', points: [...current.points, point] })
      } else {
        setDraft({ kind: 'rect', start: current.start, end: point })
      }
    }

    const finishDraw = (e: PointerEvent): void => {
      if (!drawingRef.current) return
      drawingRef.current = false
      if (surface.hasPointerCapture(e.pointerId)) {
        surface.releasePointerCapture(e.pointerId)
      }
      const current = draftRef.current
      if (!current) return
      if (current.kind === 'pen') {
        void savePen(current.points)
      } else {
        void saveRect(current.start, current.end)
      }
      setDraft(null)
    }

    const onContextMenu = (e: MouseEvent): void => {
      const tool = useWorkspaceStore.getState().annotationTool
      if (!toolUsesRightClickUndo(tool)) return
      if (tool !== 'pen' && tool !== 'rect' && tool !== 'eraser') return
      e.preventDefault()

      if ((tool === 'pen' || tool === 'rect') && drawingRef.current) {
        drawingRef.current = false
        setDraft(null)
        return
      }

      if (tool === 'pen' || tool === 'rect') {
        const last = findLastAnnotationByType(annotations, tool)
        if (last) void remove(last.id)
        return
      }

      const restored = eraserUndoStackRef.current.pop()
      if (restored) void create(annotationCreateInput(restored))
    }

    surface.addEventListener('pointerdown', onPointerDown)
    surface.addEventListener('pointermove', onPointerMove)
    surface.addEventListener('pointerup', finishDraw)
    surface.addEventListener('pointercancel', finishDraw)
    surface.addEventListener('contextmenu', onContextMenu)
    surface.addEventListener('selectstart', onSelectStart)

    return () => {
      surface.removeEventListener('pointerdown', onPointerDown)
      surface.removeEventListener('pointermove', onPointerMove)
      surface.removeEventListener('pointerup', finishDraw)
      surface.removeEventListener('pointercancel', finishDraw)
      surface.removeEventListener('contextmenu', onContextMenu)
      surface.removeEventListener('selectstart', onSelectStart)
    }
  }, [interactive, annotationTool, annotations, drawAnnotations, remove, create, savePen, saveRect, surface])

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

  return (
    <svg
      className="annotation-overlay-layer"
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
