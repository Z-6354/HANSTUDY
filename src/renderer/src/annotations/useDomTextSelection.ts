import { useEffect, useState } from 'react'
import type { TextSelectionContext } from '../types/global.d'

interface SelectionState {
  context: TextSelectionContext
  rect: DOMRect
}

export function useDomTextSelection(
  docPath: string,
  containerRef: React.RefObject<HTMLElement | null>,
  enabled = true
): SelectionState | null {
  const [selection, setSelection] = useState<SelectionState | null>(null)

  useEffect(() => {
    if (!enabled) return
    const container = containerRef.current
    if (!container) return

    const handleMouseUp = (): void => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        return
      }
      const text = sel.toString().trim()
      if (!text) return
      const range = sel.getRangeAt(0)
      if (!container.contains(range.commonAncestorContainer)) return
      const rect = range.getBoundingClientRect()
      setSelection({
        context: { docPath, text },
        rect
      })
    }

    const handleMouseDown = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      if (target.closest('.selection-toolbar')) return
      setSelection(null)
    }

    container.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      container.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [docPath, containerRef, enabled])

  return selection
}
