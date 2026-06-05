import DOMPurify from 'dompurify'
import mammoth from 'mammoth'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAnnotationSurface } from '../annotations/AnnotationSurfaceContext'
import {
  applyDomAnnotation,
  applyStoredDomAnnotations,
  blockViewerContextMenu
} from '../annotations/textUtils'
import { NoteInputModal, SelectionToolbar } from '../annotations/SelectionToolbar'
import { useAnnotations } from '../annotations/useAnnotations'
import { useDomTextSelection } from '../annotations/useDomTextSelection'
import { useWorkspaceStore } from '../stores/workspaceStore'

interface DocxViewerProps {
  filePath: string
}

const HIGHLIGHT_COLOR = '#ffd50055'
const UNDERLINE_COLOR = '#007acc'

export function DocxViewer({ filePath }: DocxViewerProps): JSX.Element {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toolbarRect, setToolbarRect] = useState<DOMRect | null>(null)
  const [pendingText, setPendingText] = useState('')
  const [showNoteModal, setShowNoteModal] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [scrollSurface, setScrollSurface] = useState<HTMLElement | null>(null)
  const { annotations, create } = useAnnotations(filePath)

  useAnnotationSurface(scrollSurface)

  useEffect(() => {
    setScrollSurface(surfaceRef.current)
  }, [html, loading])
  const { sendToAI, setSelection, annotationTool } = useWorkspaceStore()
  const domSelection = useDomTextSelection(filePath, contentRef)

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
    if (!contentRef.current) return
    applyStoredDomAnnotations(contentRef.current, annotations)
  }, [html, annotations])

  const closeToolbar = (): void => {
    setToolbarRect(null)
    setPendingText('')
  }

  const saveAnnotation = useCallback(
    async (
      type: 'highlight' | 'underline' | 'note',
      noteContent?: string,
      override?: { text?: string }
    ): Promise<void> => {
      const text = override?.text ?? pendingText
      if (!text) return
      await create({
        type,
        color: type === 'underline' ? UNDERLINE_COLOR : HIGHLIGHT_COLOR,
        selectedText: text,
        content: noteContent
      })
      if (contentRef.current && (type === 'highlight' || type === 'underline')) {
        applyDomAnnotation(contentRef.current, type, text)
      }
      closeToolbar()
      setShowNoteModal(false)
    },
    [create, pendingText]
  )

  useEffect(() => {
    if (!domSelection) return
    const text = domSelection.context.text
    setPendingText(text)
    setSelection(domSelection.context)

    if (annotationTool === 'highlight' || annotationTool === 'underline') {
      void saveAnnotation(annotationTool, undefined, { text })
      return
    }
    if (annotationTool === 'note') {
      setToolbarRect(domSelection.rect)
      setShowNoteModal(true)
      return
    }
    setToolbarRect(domSelection.rect)
  }, [domSelection, setSelection, annotationTool, saveAnnotation])

  if (loading) return <div className="loading-state">加载 Word 文档...</div>
  if (error) return <div className="error-state">{error}</div>

  return (
    <div ref={surfaceRef} className="docx-content annotated-viewer">
      <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '16px' }}>
        Word 简化视图 — 选中文本可高亮、便签或 Ask AI
      </p>
      <div
        ref={contentRef}
        onContextMenu={blockViewerContextMenu}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {toolbarRect && (
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
