import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from 'react'

const DRAG_THRESHOLD_PX = 8
const STORAGE_PREFIX = 'hanstudy-float-rail-'
const EDGE_MARGIN_PX = 10

export interface FloatPosition {
  left: number
  top: number
}

function loadPosition(key: string): FloatPosition | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FloatPosition
    if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
      return parsed
    }
  } catch {
    // ignore corrupt storage
  }
  return null
}

function savePosition(key: string, pos: FloatPosition): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(pos))
  } catch {
    // ignore quota errors
  }
}

function clampPosition(
  pos: FloatPosition,
  el: HTMLElement,
  parent: HTMLElement
): FloatPosition {
  const maxLeft = Math.max(0, parent.clientWidth - el.offsetWidth)
  const maxTop = Math.max(0, parent.clientHeight - el.offsetHeight)
  return {
    left: Math.min(Math.max(0, pos.left), maxLeft),
    top: Math.min(Math.max(0, pos.top), maxTop)
  }
}

function defaultPosition(
  side: 'left' | 'right',
  el: HTMLElement,
  parent: HTMLElement
): FloatPosition {
  const maxLeft = Math.max(0, parent.clientWidth - el.offsetWidth)
  const maxTop = Math.max(0, parent.clientHeight - el.offsetHeight)
  return {
    left: side === 'left' ? EDGE_MARGIN_PX : Math.max(EDGE_MARGIN_PX, maxLeft - EDGE_MARGIN_PX),
    top: maxTop / 2
  }
}

export function useDraggableFloat(storageKey: string, defaultSide: 'left' | 'right') {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<FloatPosition | null>(null)
  const positionRef = useRef<FloatPosition | null>(null)
  const sessionCleanupRef = useRef<(() => void) | null>(null)
  const suppressClickRef = useRef(false)

  positionRef.current = position

  const resolvePosition = useCallback((): FloatPosition | null => {
    const el = containerRef.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) return null
    const saved = loadPosition(storageKey)
    if (saved) return clampPosition(saved, el, parent)
    return clampPosition(defaultPosition(defaultSide, el, parent), el, parent)
  }, [defaultSide, storageKey])

  useLayoutEffect(() => {
    if (position != null) return
    const next = resolvePosition()
    if (next) setPosition(next)
  }, [position, resolvePosition])

  useEffect(() => {
    const onResize = (): void => {
      const el = containerRef.current
      const parent = el?.offsetParent as HTMLElement | null
      if (!el || !parent) return
      setPosition((prev) => (prev ? clampPosition(prev, el, parent) : prev))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    return () => sessionCleanupRef.current?.()
  }, [])

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0 || positionRef.current == null) return

    sessionCleanupRef.current?.()
    suppressClickRef.current = false

    const pointerId = e.pointerId
    const origin = positionRef.current
    const session = {
      pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: origin.left,
      originTop: origin.top,
      moved: false,
      latest: origin
    }

    const removeListeners = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      sessionCleanupRef.current = null
    }

    const onMove = (ev: PointerEvent): void => {
      if (ev.pointerId !== pointerId) return

      const dx = ev.clientX - session.startX
      const dy = ev.clientY - session.startY

      if (!session.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
        session.moved = true
        suppressClickRef.current = true
      }

      if (!session.moved) return

      const el = containerRef.current
      const parent = el?.offsetParent as HTMLElement | null
      if (!el || !parent) return

      const next = clampPosition(
        { left: session.originLeft + dx, top: session.originTop + dy },
        el,
        parent
      )
      session.latest = next
      setPosition(next)
    }

    const onUp = (ev: PointerEvent): void => {
      if (ev.pointerId !== pointerId) return
      removeListeners()

      if (session.moved) {
        savePosition(storageKey, session.latest)
        window.setTimeout(() => {
          suppressClickRef.current = false
        }, 0)
      }
    }

    sessionCleanupRef.current = removeListeners
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const shouldSuppressClick = (): boolean => suppressClickRef.current

  const style: CSSProperties | undefined =
    position == null
      ? { visibility: 'hidden' }
      : {
          left: position.left,
          top: position.top,
          transform: 'none',
          visibility: 'visible'
        }

  return {
    containerRef,
    style,
    shouldSuppressClick,
    dragHandlers: {
      onPointerDown: handlePointerDown
    }
  }
}
