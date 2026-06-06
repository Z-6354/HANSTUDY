import { useCallback, useRef } from 'react'

interface DragScrollHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void
  wasDragging: () => boolean
}

export function useDragScroll(): DragScrollHandlers {
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const startYRef = useRef(0)
  const startScrollRef = useRef(0)
  const targetRef = useRef<HTMLElement | null>(null)

  const endDrag = useCallback((e: React.PointerEvent<HTMLElement>): void => {
    draggingRef.current = false
    if (targetRef.current?.hasPointerCapture(e.pointerId)) {
      targetRef.current.releasePointerCapture(e.pointerId)
    }
    if (targetRef.current) targetRef.current.style.cursor = ''
    targetRef.current = null
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>): void => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, textarea, [data-no-drag-scroll]')) return
    const el = e.currentTarget
    draggingRef.current = true
    movedRef.current = false
    startYRef.current = e.clientY
    startScrollRef.current = el.scrollTop
    targetRef.current = el
    el.setPointerCapture(e.pointerId)
    el.style.cursor = 'grabbing'
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>): void => {
    if (!draggingRef.current || !targetRef.current) return
    const dy = e.clientY - startYRef.current
    if (Math.abs(dy) > 3) movedRef.current = true
    targetRef.current.scrollTop = startScrollRef.current - dy
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>): void => {
      const dragged = movedRef.current
      endDrag(e)
      if (!dragged) movedRef.current = false
    },
    [endDrag]
  )

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLElement>): void => {
      movedRef.current = false
      endDrag(e)
    },
    [endDrag]
  )

  const wasDragging = useCallback((): boolean => movedRef.current, [])

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, wasDragging }
}
