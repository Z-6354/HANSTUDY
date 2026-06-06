import type { Annotation, DrawShape, ShapePoint } from '../types/global.d'

const ERASER_HIT_PX = 12

export function getContentSize(surface: HTMLElement): { width: number; height: number } {
  return {
    width: Math.max(1, surface.scrollWidth),
    height: Math.max(1, surface.scrollHeight)
  }
}

/** 屏幕坐标 → 相对文档内容表面的归一化坐标 (0–1) */
export function clientToContentPoint(
  clientX: number,
  clientY: number,
  surface: HTMLElement
): ShapePoint {
  const rect = surface.getBoundingClientRect()
  const { width, height } = getContentSize(surface)
  const x = surface.scrollLeft + (clientX - rect.left)
  const y = surface.scrollTop + (clientY - rect.top)
  return {
    x: Math.min(1, Math.max(0, x / width)),
    y: Math.min(1, Math.max(0, y / height))
  }
}

/** 屏幕坐标 → 内容表面像素坐标 */
export function clientToContentPixels(
  clientX: number,
  clientY: number,
  surface: HTMLElement
): { x: number; y: number } {
  const rect = surface.getBoundingClientRect()
  return {
    x: surface.scrollLeft + (clientX - rect.left),
    y: surface.scrollTop + (clientY - rect.top)
  }
}

export function shapeToPixels(
  shape: DrawShape,
  width: number,
  height: number
): {
  points?: { x: number; y: number }[]
  x?: number
  y?: number
  width?: number
  height?: number
  strokeWidth: number
} {
  const strokeWidth = shape.strokeWidth ?? 2
  if (shape.points?.length) {
    return {
      points: shape.points.map((p: ShapePoint) => ({ x: p.x * width, y: p.y * height })),
      strokeWidth
    }
  }
  return {
    x: (shape.x ?? 0) * width,
    y: (shape.y ?? 0) * height,
    width: (shape.width ?? 0) * width,
    height: (shape.height ?? 0) * height,
    strokeWidth
  }
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1)
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

export function hitTestAnnotation(
  annotation: Annotation,
  clientX: number,
  clientY: number,
  surface: HTMLElement
): boolean {
  if (!annotation.shape) return false

  const { x: px, y: py } = clientToContentPixels(clientX, clientY, surface)
  const { width: w, height: h } = getContentSize(surface)
  const scaled = shapeToPixels(annotation.shape, w, h)

  if (annotation.type === 'rect' && scaled.width != null && scaled.height != null) {
    const pad = ERASER_HIT_PX
    return (
      px >= (scaled.x ?? 0) - pad &&
      px <= (scaled.x ?? 0) + scaled.width + pad &&
      py >= (scaled.y ?? 0) - pad &&
      py <= (scaled.y ?? 0) + scaled.height + pad
    )
  }

  if (annotation.type === 'pen' && scaled.points && scaled.points.length > 1) {
    for (let i = 1; i < scaled.points.length; i++) {
      const a = scaled.points[i - 1]
      const b = scaled.points[i]
      if (distToSegment(px, py, a.x, a.y, b.x, b.y) <= ERASER_HIT_PX) {
        return true
      }
    }
  }

  return false
}

export function normalizeRect(
  start: ShapePoint,
  end: ShapePoint
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)
  return { x, y, width, height }
}
