import { useEffect, useRef } from 'react'
import type { TextRange } from '../../../types/global.d'
import type { DomTextSelectionState } from './useDomTextSelection'

type MarkupType = 'highlight' | 'underline'

interface UseDomSelectionEffectOptions {
  domSelection: DomTextSelectionState | null
  clearSelection: () => void
  annotationTool: string
  setSelection: (ctx: DomTextSelectionState['context']) => void
  setPendingText: (text: string) => void
  setToolbarRect: (rect: DOMRect | null) => void
  setShowNoteModal: (show: boolean) => void
  saveAnnotation: (
    type: MarkupType | 'note',
    noteContent?: string,
    override?: { text?: string; range?: TextRange | null; domRange?: Range | null }
  ) => Promise<void>
}

/**
 * 处理 DOM 文本选区：仅在 domSelection 非空（本次 mouseup）时响应，避免工具切换误用陈旧选区。
 */
export function useDomSelectionEffect({
  domSelection,
  clearSelection,
  annotationTool,
  setSelection,
  setPendingText,
  setToolbarRect,
  setShowNoteModal,
  saveAnnotation
}: UseDomSelectionEffectOptions): void {
  const saveAnnotationRef = useRef(saveAnnotation)
  saveAnnotationRef.current = saveAnnotation
  const applyingRef = useRef(false)
  const lastHandledKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!domSelection) {
      lastHandledKeyRef.current = null
      return
    }
    if (lastHandledKeyRef.current === domSelection.key) return

    const text = domSelection.context.text
    setSelection(domSelection.context)

    if (annotationTool === 'highlight' || annotationTool === 'underline') {
      if (applyingRef.current) return
      applyingRef.current = true
      lastHandledKeyRef.current = domSelection.key
      const domRange = domSelection.domRange.cloneRange()
      clearSelection()
      void saveAnnotationRef
        .current(annotationTool, undefined, { text, range: null, domRange })
        .finally(() => {
          applyingRef.current = false
        })
      return
    }

    if (annotationTool === 'note') {
      lastHandledKeyRef.current = domSelection.key
      setPendingText(text)
      setToolbarRect(domSelection.rect)
      setShowNoteModal(true)
      return
    }

    if (annotationTool === 'select') {
      lastHandledKeyRef.current = domSelection.key
      setPendingText(text)
      setToolbarRect(domSelection.rect)
    }
  }, [
    domSelection,
    annotationTool,
    clearSelection,
    setSelection,
    setPendingText,
    setToolbarRect,
    setShowNoteModal
  ])
}
