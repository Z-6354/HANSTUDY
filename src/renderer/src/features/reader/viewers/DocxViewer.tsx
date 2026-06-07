import DOMPurify from 'dompurify'
import mammoth from 'mammoth'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SelectionToolbar } from '../selection/SelectionToolbar'
import {
  useDomTextSelection,
  useSelectionToolbarEffect
} from '../selection/useDomTextSelection'
import { useDomFind } from '../find/useDomFind'
import { useViewerCommand } from '../find/useViewerCommand'
import { selectAllInElement } from '../find/domFind'
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

  const contentRef = useRef<HTMLDivElement>(null)
  const { sendToAI, setSelection } = useWorkspaceStore()

  const { selection: domSelection, clearSelection } = useDomTextSelection(
    filePath,
    contentRef,
    isActive && !loading
  )
  useSelectionToolbarEffect(domSelection, setSelection, setToolbarRect, setPendingText)
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

    void loadDocx()
    return () => {
      cancelled = true
      setHtml('')
      if (contentRef.current) contentRef.current.innerHTML = ''
    }
  }, [filePath])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.innerHTML = html
  }, [html])

  const closeToolbar = useCallback((): void => {
    setToolbarRect(null)
    setPendingText('')
    clearSelection()
  }, [clearSelection])

  if (loading) return <div className="loading-state">加载 Word 文档...</div>
  if (error) return <div className="error-state">{error}</div>

  return (
    <div className="docx-content">
      <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '16px' }}>
        Word 简化视图 — 选中文本可 Ask AI
      </p>
      <div ref={contentRef} />

      {toolbarRect && (
        <SelectionToolbar
          rect={toolbarRect}
          onAskAI={() => {
            sendToAI(pendingText, filePath)
            closeToolbar()
          }}
          onClose={closeToolbar}
        />
      )}
    </div>
  )
}
