import { useEffect, useRef, type ReactNode } from 'react'

interface PdfSideHoverProps {
  side: 'left' | 'right'
  open: boolean
  setOpen: (open: boolean) => void
  label: string
  /** 为 true 时鼠标离开不自动收起（点击或工具栏打开） */
  pinned?: boolean
  onPinnedChange?: (pinned: boolean) => void
  /** 面板展开前同步调用（如提交 PDF 缩放预览） */
  onHoverStart?: () => void
  children: ReactNode
}

const CLOSE_DELAY_MS = 220

export function PdfSideHover({
  side,
  open,
  setOpen,
  label,
  pinned = false,
  onPinnedChange,
  onHoverStart,
  children
}: PdfSideHoverProps): JSX.Element {
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCloseTimer = (): void => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const openPanel = (): void => {
    clearCloseTimer()
    if (onHoverStart) {
      onHoverStart()
      return
    }
    setOpen(true)
  }

  const closePanel = (): void => {
    clearCloseTimer()
    onPinnedChange?.(false)
    setOpen(false)
  }

  const handleHoverEnter = (): void => {
    if (pinned) return
    openPanel()
  }

  const handleTriggerClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    clearCloseTimer()
    if (open) {
      closePanel()
      return
    }
    onPinnedChange?.(true)
    openPanel()
  }

  const handleLeave = (): void => {
    if (pinned) return
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      setOpen(false)
    }, CLOSE_DELAY_MS)
  }

  useEffect(() => {
    return () => clearCloseTimer()
  }, [])

  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
    }

    root.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => root.removeEventListener('wheel', onWheel, { capture: true })
  }, [])

  return (
    <div
      ref={rootRef}
      className={`pdf-side-hover pdf-side-hover--${side}${open ? ' open' : ''}`}
      onMouseLeave={handleLeave}
      aria-label={label}
    >
      <button
        type="button"
        className="pdf-side-trigger"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onMouseEnter={handleHoverEnter}
        onClick={handleTriggerClick}
      />
      <div
        className={`pdf-side-panel pdf-side-panel--${side}${open ? '' : ' pdf-side-panel--collapsed'}`}
        role="region"
        aria-hidden={!open}
        onMouseEnter={handleHoverEnter}
      >
        {children}
      </div>
    </div>
  )
}
