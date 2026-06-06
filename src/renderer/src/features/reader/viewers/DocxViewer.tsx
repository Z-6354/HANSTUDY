import DOMPurify from 'dompurify'
import mammoth from 'mammoth'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAnnotationSurface } from '../../../features/reader/annotations/AnnotationSurfaceContext'
import { resolveMarkupColor } from '../annotations/annotationMarkup'
import { applyDomAnnotation, refreshTextMarkup, blockViewerContextMenu, scrollToAnnotationText } from '../annotations/textUtils'
import { NoteInputModal, SelectionToolbar } from '../../../features/reader/annotations/SelectionToolbar'
import { useAnnotations } from '../../../features/reader/annotations/useAnnotations'
import { useDomTextSelection } from '../../../features/reader/annotations/useDomTextSelection'
import { useDomSelectionEffect } from '../../../features/reader/annotations/useDomSelectionEffect'
import { useDomAnnotationToolUndo } from '../../../features/reader/annotations/useAnnotationToolUndo'
import { useDomFind } from '../../../features/reader/find/useDomFind'
import { useViewerCommand } from '../../../features/reader/find/useViewerCommand'
import { selectAllInElement } from '../../../features/reader/find/domFind'
import { useWorkspaceStore } from '../../../stores/workspaceStore'

interface DocxViewerProps {
  filePath: string
  isActive?: boolean
}

export function DocxViewer({ filePath, isActive = true }: DocxViewerProps): JSX.Element {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toolbarRect, setToolbarRect] = useState<DOMRect | null>(null)
  const [pendingText, setPendingText] = useState('')
  const [showNoteModal, setShowNoteModal] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [scrollSurface, setScrollSurface] = useState<HTMLElement | null>(null)
  const { annotations, create, remove } = useAnnotations(filePath, isActive)

  useAnnotationSurface(scrollSurface)

  useEffect(() => {
    setScrollSurface(surfaceRef.current)
  }, [html, loading])
  const { sendToAI, setSelection, annotationTool, focusAnnotationId, setFocusAnnotationId } =
    useWorkspaceStore()
  const drawTool =
    annotationTool === 'pen' || annotationTool === 'rect' || annotationTool === 'eraser'
  const textSelectEnabled = isActive && !drawTool
  const { selection: domSelection, clearSelection: clearDomSelection } = useDomTextSelection(
    filePath,
    contentRef,
    textSelectEnabled
  )
  useDomAnnotationToolUndo(annotations, remove, contentRef, isActive)
  useDomFind(contentRef.current, isActive)
  useViewerCommand(isActive, 'selectAll', () => selectAllInElement(contentRef.current))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const loadDocx = async (): Promise<void> => {
      try {
        const bytes = await window.api.fs.readBinary(filePath)
        const arrayBuffer = new Uint8Array(bytes).buffer
        const result = await mammoth.convertToHtml({ arrayBuffer })
        if (!cancelled) setHtml(DOMPurify.sanitize(result.value))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '无法加载 Word 文档')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDocx()
    return () => {
      cancelled = true
    }
  }, [filePath])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.innerHTML = html
  }, [html])

  useEffect(() => {
    if (!contentRef.current) return
    refreshTextMarkup(contentRef.current, annotations)
  }, [html, annotations])

  const closeToolbar = (): void => {
    setToolbarRect(null)
    setPendingText('')
    clearDomSelection()
  }

  const saveAnnotation = useCallback(
    async (
      type: 'highlight' | 'underline' | 'note',
      noteContent?: string,
      override?: { text?: string; domRange?: Range | null }
    ): Promise<void> => {
      const text = override?.text ?? pendingText
      if (!text) return
      const color = resolveMarkupColor(type === 'note' ? 'note' : type)
      if (contentRef.current && (type === 'highlight' || type === 'underline')) {
        applyDomAnnotation(contentRef.current, type, text, override?.domRange, color)
      }
      await create({
        type,
        color,
        selectedText: text,
        content: noteContent
      })
      closeToolbar()
      setShowNoteModal(false)
    },
    [create, pendingText]
  )

  useDomSelectionEffect({
    domSelection,
    clearSelection: clearDomSelection,
    annotationTool,
    setSelection,
    setPendingText,
    setToolbarRect,
    setShowNoteModal,
    saveAnnotation
  })

  useEffect(() => {
    if (!focusAnnotationId || !contentRef.current) return
    const ann = annotations.find((a) => a.id === focusAnnotationId)
    if (!ann) {
      setFocusAnnotationId(null)
      return
    }
    if (ann.selectedText) {
      scrollToAnnotationText(contentRef.current, ann.selectedText)
    }
    setFocusAnnotationId(null)
  }, [focusAnnotationId, annotations, setFocusAnnotationId])

  if (loading) return <div className="loading-state">加载 Word 文档...</div>
  if (error) return <div className="error-state">{error}</div>

  return (
    <div ref={surfaceRef} className="docx-content annotated-viewer">
      <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '16px' }}>
        Word 简化视图 — 选中文本可高亮、便签或 Ask AI
      </p>
      <div ref={contentRef} onContextMenu={blockViewerContextMenu} />

      {toolbarRect && annotationTool === 'select' && (
        <SelectionToolbar
          rect={toolbarRect}
          onHighlight={() => saveAnnotation('highlight')}
          onUnderline={() => saveAnnotation('underline')}
          onNote={() => setShowNoteModal(true)}
          onAskAI={() => {
            sendToAI(pendingText, filePath)
            closeToolbar()
          }}
          onClose={closeToolbar}
        />
      )}

      {showNoteModal && (
        <NoteInputModal
          onSubmit={(c) => saveAnnotation('note', c)}
          onCancel={() => setShowNoteModal(false)}
        />
      )}
    </div>
  )
}
