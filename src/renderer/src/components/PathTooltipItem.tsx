import { useState } from 'react'
import { createPortal } from 'react-dom'

interface PathTooltipItemProps {
  path: string
  className?: string
  onClick?: () => void
  children: React.ReactNode
}

export function PathTooltipItem({
  path,
  className,
  onClick,
  children
}: PathTooltipItemProps): JSX.Element {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const maxWidth = Math.min(480, window.innerWidth - 16)
    let x = rect.left
    if (x + maxWidth > window.innerWidth - 8) {
      x = window.innerWidth - maxWidth - 8
    }
    setCoords({ x: Math.max(8, x), y: rect.bottom + 6 })
    setVisible(true)
  }

  return (
    <>
      <button
        type="button"
        className={className}
        title={path}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisible(false)}
        onClick={onClick}
      >
        {children}
      </button>
      {visible &&
        createPortal(
          <div className="path-tooltip" style={{ left: coords.x, top: coords.y }} role="tooltip">
            {path}
          </div>,
          document.body
        )}
    </>
  )
}
