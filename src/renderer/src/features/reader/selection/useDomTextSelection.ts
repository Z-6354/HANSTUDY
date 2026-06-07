import { useCallback, useEffect, useRef, useState } from 'react'
import type { TextSelectionContext } from '../../../types/global.d'
import { buildDomSelectionKey } from './selectionKey'
import { normalizePdfWindowSelection } from './pdfTextSelection'

export interface DomTextSelectionState {
  context: TextSelectionContext
  rect: DOMRect
  key: string
}

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

      const normalized = mode === 'pdf' ? normalizePdfWindowSelection(sel) : null
      const range = normalized?.range ?? sel.getRangeAt(0).cloneRange()
      const text = (normalized?.text ?? range.toString().replace(/\r\n/g, '\n'))
      if (!text.trim()) return
      if (!container.contains(range.commonAncestorContainer)) return
      const key = buildDomSelectionKey(docPath, text, range)
      if (consumedKeysRef.current.has(key)) return
      const rect = range.getBoundingClientRect()
      setSelection({
        context: { docPath, text },
        rect,
        key
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

export function useSelectionToolbarEffect(
  domSelection: DomTextSelectionState | null,
  setSelection: (ctx: TextSelectionContext | null) => void,
  setToolbarRect: (rect: DOMRect | null) => void,
  setPendingText: (text: string) => void
): void {
  const lastKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!domSelection) {
      lastKeyRef.current = null
      return
    }
    if (lastKeyRef.current === domSelection.key) return
    lastKeyRef.current = domSelection.key
    setSelection(domSelection.context)
    setPendingText(domSelection.context.text)
    setToolbarRect(domSelection.rect)
  }, [domSelection, setSelection, setToolbarRect, setPendingText])
}
