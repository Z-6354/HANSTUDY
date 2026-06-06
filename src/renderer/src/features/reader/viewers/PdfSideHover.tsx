import { useEffect, useRef, type ReactNode } from 'react'

interface PdfSideHoverProps {
  side: 'left' | 'right'
  open: boolean
  setOpen: (open: boolean) => void
  label: string
  children: ReactNode
}

const CLOSE_DELAY_MS = 220

export function PdfSideHover({
  side,
  open,
  setOpen,
  label,
  children
}: PdfSideHoverProps): JSX.Element {
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleEnter = (): void => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setOpen(true)
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

  return (
    <div
      className={`pdf-side-hover pdf-side-hover--${side}${open ? ' open' : ''}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      aria-label={label}
    >
      <div className="pdf-side-trigger" title={label} />
      <div className={`pdf-side-panel pdf-side-panel--${side}`} role="region" aria-hidden={!open}>
        {open ? children : null}
      </div>
    </div>
  )
}
