import Editor, { Monaco } from '@monaco-editor/react'
import { Eye, Code } from 'lucide-react'
import { IconButton } from '../components/IconButton'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { editor as MonacoEditor } from 'monaco-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAnnotationSurface } from '../annotations/AnnotationSurfaceContext'
import { applyDomAnnotation, applyStoredDomAnnotations, blockViewerContextMenu } from '../annotations/textUtils'
import { NoteInputModal, SelectionToolbar } from '../annotations/SelectionToolbar'
import { useAnnotations } from '../annotations/useAnnotations'
import { useDomTextSelection } from '../annotations/useDomTextSelection'
import type { TextRange } from '../types/global.d'
import { useWorkspaceStore } from '../stores/workspaceStore'

export type MdViewMode = 'preview' | 'source'

interface MdViewerProps {
  filePath: string
}

const VIEW_MODE_KEY = 'hanstudy-md-view-mode'
const HIGHLIGHT_COLOR = '#ffd50055'
const UNDERLINE_COLOR = '#007acc'

function loadViewMode(filePath: string): MdViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY)
    if (!raw) return 'preview'
    const map = JSON.parse(raw) as Record<string, MdViewMode>
    return map[filePath] ?? 'preview'
  } catch {
    return 'preview'
  }
}

function saveViewMode(filePath: string, mode: MdViewMode): void {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, MdViewMode>) : {}
    map[filePath] = mode
    localStorage.setItem(VIEW_MODE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

marked.setOptions({ gfm: true, breaks: true })

export function MdViewer({ filePath }: MdViewerProps): JSX.Element {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<MdViewMode>(() => loadViewMode(filePath))
  const [toolbarRect, setToolbarRect] = useState<DOMRect | null>(null)
  const [pendingRange, setPendingRange] = useState<TextRange | null>(null)
  const [pendingText, setPendingText] = useState('')
  const [showNoteModal, setShowNoteModal] = useState(false)

  const previewRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const decorationIdsRef = useRef<string[]>([])
  const [scrollSurface, setScrollSurface] = useState<HTMLElement | null>(null)

  useAnnotationSurface(scrollSurface)

  const { annotations, create } = useAnnotations(filePath)
  const { sendToAI, setSelection, focusAnnotationId, setFocusAnnotationId, annotationTool } =
    useWorkspaceStore()
  const domSelection = useDomTextSelection(filePath, previewRef, viewMode === 'preview')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setViewMode(loadViewMode(filePath))

    window.api.fs
      .readText(filePath)
      .then((text) => {
        if (!cancelled) setContent(text)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || '无法读取文件')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filePath])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault()
        setViewMode((mode) => {
          const next = mode === 'preview' ? 'source' : 'preview'
          saveViewMode(filePath, next)
          return next
        })
        closeToolbar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filePath])

  const previewHtml = useMemo(() => {
    if (!content) return ''
    return DOMPurify.sanitize(marked.parse(content) as string)
  }, [content])

  useEffect(() => {
    if (viewMode === 'preview') {
      setScrollSurface(previewRef.current)
      return
    }
    const editor = editorRef.current
    const el = editor
      ?.getDomNode()
      ?.querySelector('.monaco-scrollable-element') as HTMLElement | null
    setScrollSurface(el)
  }, [viewMode, previewHtml, loading])

  useEffect(() => {
    if (viewMode !== 'preview' || !previewRef.current) return
    applyStoredDomAnnotations(previewRef.current, annotations)
  }, [previewHtml, annotations, viewMode])

  const applyDecorations = useCallback(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return
    const decos = annotations
      .filter((a) => a.range && (a.type === 'highlight' || a.type === 'underline'))
      .map((a) => ({
        range: new monaco.Range(
          a.range!.startLine,
          a.range!.startColumn,
          a.range!.endLine,
          a.range!.endColumn
        ),
        options: {
          inlineClassName:
            a.type === 'highlight' ? 'annotation-highlight' : 'annotation-underline',
          overviewRuler: {
            color: a.type === 'highlight' ? HIGHLIGHT_COLOR : UNDERLINE_COLOR,
            position: monaco.editor.OverviewRulerLane.Full
          }
        }
      }))
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, decos)
  }, [annotations])

  useEffect(() => {
    if (viewMode === 'source') applyDecorations()
  }, [applyDecorations, viewMode, content])

  useEffect(() => {
    if (!focusAnnotationId) return
    const ann = annotations.find((a) => a.id === focusAnnotationId)
    if (!ann?.range || viewMode !== 'source') {
      setFocusAnnotationId(null)
      return
    }
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return
    editor.revealRangeInCenter(
      new monaco.Range(
        ann.range.startLine,
        ann.range.startColumn,
        ann.range.endLine,
        ann.range.endColumn
      )
    )
    setFocusAnnotationId(null)
  }, [focusAnnotationId, annotations, viewMode, setFocusAnnotationId])

  const closeToolbar = (): void => {
    setToolbarRect(null)
    setPendingRange(null)
    setPendingText('')
  }

  const saveAnnotation = useCallback(
    async (
      type: 'highlight' | 'underline' | 'note',
      noteContent?: string,
      override?: { text?: string; range?: TextRange | null }
    ): Promise<void> => {
      const text = override?.text ?? pendingText
      const range = override?.range !== undefined ? override.range : pendingRange
      if (!text) return
      await create({
        type,
        color: type === 'underline' ? UNDERLINE_COLOR : HIGHLIGHT_COLOR,
        selectedText: text,
        content: noteContent,
        range: range ?? undefined
      })
      if (
        viewMode === 'preview' &&
        previewRef.current &&
        (type === 'highlight' || type === 'underline')
      ) {
        applyDomAnnotation(previewRef.current, type, text)
      }
      closeToolbar()
      setShowNoteModal(false)
    },
    [create, pendingText, pendingRange, viewMode]
  )

  useEffect(() => {
    if (!domSelection) return
    const text = domSelection.context.text
    setPendingText(text)
    setPendingRange(null)
    setSelection(domSelection.context)

    if (annotationTool === 'highlight' || annotationTool === 'underline') {
      void saveAnnotation(annotationTool, undefined, { text, range: null })
      return
    }
    if (annotationTool === 'note') {
      setToolbarRect(domSelection.rect)
      setShowNoteModal(true)
      return
    }
    setToolbarRect(domSelection.rect)
  }, [domSelection, setSelection, annotationTool, saveAnnotation])

  const captureMonacoSelection = useCallback((): void => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return
    const sel = editor.getSelection()
    const model = editor.getModel()
    if (!sel || sel.isEmpty() || !model) return
    const text = model.getValueInRange(sel)
    if (!text.trim()) return
    const range: TextRange = {
      startLine: sel.startLineNumber,
      startColumn: sel.startColumn,
      endLine: sel.endLineNumber,
      endColumn: sel.endColumn
    }

    const tool = useWorkspaceStore.getState().annotationTool
    if (tool === 'highlight' || tool === 'underline') {
      void saveAnnotation(tool, undefined, { text, range })
      return
    }
    if (tool === 'note') {
      setPendingRange(range)
      setPendingText(text)
      setSelection({ docPath: filePath, text, range })
      setShowNoteModal(true)
      return
    }

    setPendingRange(range)
    setPendingText(text)
    setSelection({ docPath: filePath, text, range })
    const coords = editor.getScrolledVisiblePosition({
      lineNumber: sel.startLineNumber,
      column: sel.startColumn
    })
    if (coords) {
      const editorRect = editor.getDomNode()!.getBoundingClientRect()
      setToolbarRect(
        new DOMRect(editorRect.left + coords.left, editorRect.top + coords.top, 100, coords.height)
      )
    }
  }, [filePath, saveAnnotation, setSelection])

  const switchMode = (mode: MdViewMode): void => {
    setViewMode(mode)
    saveViewMode(filePath, mode)
    closeToolbar()
  }

  if (loading) return <div className="loading-state">加载中...</div>
  if (error) return <div className="error-state">{error}</div>

  return (
    <div className="md-viewer annotated-viewer">
      <div className="viewer-toolbar">
        <div className="view-mode-toggle">
          <IconButton
            icon={Eye}
            label="预览"
            className={`view-mode-btn ${viewMode === 'preview' ? 'active' : ''}`}
            active={viewMode === 'preview'}
            onClick={() => switchMode('preview')}
          />
          <IconButton
            icon={Code}
            label="文本"
            className={`view-mode-btn ${viewMode === 'source' ? 'active' : ''}`}
            active={viewMode === 'source'}
            onClick={() => switchMode('source')}
          />
        </div>
        <span className="viewer-toolbar-hint">Ctrl+Shift+V 切换 · 选中文本可标注</span>
      </div>

      {viewMode === 'preview' ? (
        <div
          ref={previewRef}
          className="markdown-preview"
          onContextMenu={blockViewerContextMenu}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      ) : (
        <div className="md-source-editor">
          <Editor
            height="100%"
            language="markdown"
            value={content}
            theme="vs-light"
            onMount={(editor, monaco) => {
              editorRef.current = editor
              monacoRef.current = monaco
              editor.onMouseUp(() => setTimeout(captureMonacoSelection, 10))
              applyDecorations()
            }}
            options={{
              readOnly: true,
              minimap: { enabled: true },
              wordWrap: 'on',
              fontSize: 14,
              fontFamily: 'var(--font-mono)',
              scrollBeyondLastLine: false,
              renderLineHighlight: 'none',
              contextmenu: false,
              automaticLayout: true
            }}
          />
        </div>
      )}

      {toolbarRect && (
        <SelectionToolbar
          rect={toolbarRect}
          onHighlight={() => saveAnnotation('highlight')}
          onUnderline={() => saveAnnotation('underline')}
          onNote={() => setShowNoteModal(true)}
          onAskAI={() => {
            sendToAI(pendingText, filePath, pendingRange ?? undefined)
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
