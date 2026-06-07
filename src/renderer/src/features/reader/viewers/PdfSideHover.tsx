import { useEffect, useRef, type ReactNode } from 'react'

interface PdfSideHoverProps {
  side: 'left' | 'right'
  open: boolean
  setOpen: (open: boolean) => void
  label: string
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
  onHoverStart,
  children
}: PdfSideHoverProps): JSX.Element {
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleOpen = (): void => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    if (onHoverStart) {
      onHoverStart()
    } else {
      setOpen(true)
    }
  }

  const handleLeave = (): void => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      setOpen(false)
    }, CLOSE_DELAY_MS)
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
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
      <div
        className="pdf-side-trigger"
        title={label}
        role="button"
        tabIndex={0}
        aria-label={label}
        onMouseEnter={handleOpen}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleOpen()
          }
        }}
      />
      <div
        className={`pdf-side-panel pdf-side-panel--${side}${open ? '' : ' pdf-side-panel--collapsed'}`}
        role="region"
        aria-hidden={!open}
        onMouseEnter={handleOpen}
      >
        {children}
      </div>
    </div>
  )
}
