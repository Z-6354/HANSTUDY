import { useCallback, useEffect, useRef, useState } from 'react'
import type { TextSelectionContext } from '../../../types/global.d'

export interface DomTextSelectionState {
  context: TextSelectionContext
  rect: DOMRect
  /** 同一次拖选的唯一键，用于去重 */
  key: string
  /** 克隆的 DOM Range，用于跨节点高亮（须在 DOM 变更前使用） */
  domRange: Range
}

import { buildDomSelectionKey } from './selectionKey'
import { normalizePdfWindowSelection } from './pdfTextSelection'

export type DomTextSelectionMode = 'default' | 'pdf'

export function useDomTextSelection(
  docPath: string,
  containerRef: React.RefObject<HTMLElement | null>,
  enabled = true,
  mode: DomTextSelectionMode = 'default'
): {
  selection: DomTextSelectionState | null
  clearSelection: () => void
} {
  const [selection, setSelection] = useState<DomTextSelectionState | null>(null)
  const consumedKeysRef = useRef<Set<string>>(new Set())

  const clearSelection = useCallback((): void => {
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }, [])

  useEffect(() => {
    if (!enabled) {
      setSelection(null)
      return
    }
    const container = containerRef.current
    if (!container) return

    const handleMouseUp = (): void => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount) return

      const normalized =
        mode === 'pdf' ? normalizePdfWindowSelection(sel) : null

      const range = normalized?.range ?? sel.getRangeAt(0).cloneRange()
      const text = (
        normalized?.text ?? range.toString().replace(/\r\n/g, '\n')
      )
      if (!text.trim()) return
      if (!container.contains(range.commonAncestorContainer)) return
      const key = buildDomSelectionKey(docPath, text, range)
      if (consumedKeysRef.current.has(key)) return
      const rect = range.getBoundingClientRect()
      setSelection({
        context: { docPath, text },
        rect,
        key,
        domRange: range
      })
    }

    const handleMouseDown = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      if (target.closest('.selection-toolbar')) return
      consumedKeysRef.current.clear()
      setSelection(null)
    }

    container.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      container.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [docPath, containerRef, enabled, mode])

  const clearSelectionAndConsume = useCallback((): void => {
    if (selection?.key) consumedKeysRef.current.add(selection.key)
    clearSelection()
  }, [selection?.key, clearSelection])

  return { selection, clearSelection: clearSelectionAndConsume }
}
