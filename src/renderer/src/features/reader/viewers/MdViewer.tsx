import Editor from '@monaco-editor/react'
import { Eye, Code } from 'lucide-react'
import { IconButton } from '../../../components/IconButton'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type * as MonacoApi from 'monaco-editor'
import type { editor as MonacoEditor } from 'monaco-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBindAnnotationSurface } from '../../../features/reader/annotations/useBindAnnotationSurface'
import { resolveMarkupColor } from '../../../features/reader/annotations/annotationMarkup'
import {
  monacoRangeToContentRects,
  resolveDomMarkupRects
} from '../../../features/reader/annotations/markupOverlayUtils'
import { blockViewerContextMenu, scrollToAnnotationText } from '../../../features/reader/annotations/textUtils'
import { useRegisterMarkupResolver } from '../../../features/reader/annotations/useRegisterMarkupResolver'
import { NoteInputModal, SelectionToolbar } from '../../../features/reader/annotations/SelectionToolbar'
import { useAnnotations } from '../../../features/reader/annotations/useAnnotations'
import { useDomTextSelection } from '../../../features/reader/annotations/useDomTextSelection'
import { useDomSelectionEffect } from '../../../features/reader/annotations/useDomSelectionEffect'
import { useDomAnnotationToolUndo, useMonacoAnnotationToolUndo } from '../../../features/reader/annotations/useAnnotationToolUndo'
import { useDomFind } from '../../../features/reader/find/useDomFind'
import { useViewerCommand } from '../../../features/reader/find/useViewerCommand'
import { selectAllInElement } from '../../../features/reader/find/domFind'
import type { Annotation, TextRange } from '../../../types/global.d'
import { useWorkspaceStore } from '../../../stores/workspaceStore'

export type MdViewMode = 'preview' | 'source'

interface MdViewerProps {
  filePath: string
  isActive?: boolean
}

const VIEW_MODE_KEY = 'hanstudy-md-view-mode'

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

export function MdViewer({ filePath, isActive = true }: MdViewerProps): JSX.Element {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<MdViewMode>(() => loadViewMode(filePath))
  const [toolbarRect, setToolbarRect] = useState<DOMRect | null>(null)
  const [pendingRange, setPendingRange] = useState<TextRange | null>(null)
  const [pendingText, setPendingText] = useState('')
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [monacoMounted, setMonacoMounted] = useState(false)

  const previewHostRef = useRef<HTMLDivElement | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof MonacoApi | null>(null)
  const monacoSurfaceRef = useRef<HTMLElement | null>(null)
  const monacoApplyingRef = useRef(false)
  const bindAnnotationSurface = useBindAnnotationSurface()

  const { annotations, create, remove } = useAnnotations(filePath, isActive)
  const { sendToAI, setSelection, focusAnnotationId, setFocusAnnotationId, annotationTool, closeFindBar } =
    useWorkspaceStore()
  const drawTool =
    annotationTool === 'pen' || annotationTool === 'rect' || annotationTool === 'eraser'
  const previewTextEnabled = isActive && viewMode === 'preview' && !drawTool
  const { selection: domSelection, clearSelection: clearDomSelection } = useDomTextSelection(
    filePath,
    previewRef,
    previewTextEnabled
  )
  useDomAnnotationToolUndo(annotations, remove, previewRef, previewTextEnabled)
  useMonacoAnnotationToolUndo(
    annotations,
    remove,
    () => editorRef.current?.getDomNode() ?? null,
    isActive && viewMode === 'source' && monacoMounted
  )

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

  const bindPreviewHost = useCallback(
    (el: HTMLDivElement | null) => {
      previewHostRef.current = el
      if (viewMode === 'preview') bindAnnotationSurface(el)
    },
    [viewMode, bindAnnotationSurface]
  )

  useEffect(() => {
    if (!isActive) {
      bindAnnotationSurface(null)
      return
    }
    if (viewMode === 'preview') {
      bindAnnotationSurface(previewHostRef.current)
      return
    }
    const editor = editorRef.current
    if (!editor || !monacoMounted) {
      bindAnnotationSurface(null)
      return
    }
    const el = editor
      .getDomNode()
      ?.querySelector('.monaco-scrollable-element') as HTMLElement | null
    monacoSurfaceRef.current = el
    bindAnnotationSurface(el)
  }, [viewMode, previewHtml, loading, monacoMounted, isActive, bindAnnotationSurface])

  useEffect(() => {
    const el = previewRef.current
    if (!el || viewMode !== 'preview') return
    el.innerHTML = previewHtml
  }, [previewHtml, viewMode])

  const resolveMarkupRects = useCallback(
    (ann: Annotation) => {
      if (viewMode === 'source') {
        const editor = editorRef.current
        const monaco = monacoRef.current
        const surface = monacoSurfaceRef.current
        if (!editor || !monaco || !surface || !ann.range) return []
        return monacoRangeToContentRects(editor, monaco, ann.range, surface)
      }
      const surface = previewHostRef.current
      const root = previewRef.current
      if (!surface || !root) return []
      return resolveDomMarkupRects(ann, surface, root)
    },
    [viewMode, previewHtml, content, monacoMounted]
  )
  useRegisterMarkupResolver(resolveMarkupRects, isActive && !loading)

  useDomFind(previewRef.current, isActive && viewMode === 'preview')

  useViewerCommand(isActive && viewMode === 'source', 'find', () => {
    editorRef.current?.getAction('actions.find')?.run()
    closeFindBar()
  })

  useViewerCommand(isActive && viewMode === 'preview', 'selectAll', () => {
    selectAllInElement(previewRef.current)
  })

  useViewerCommand(isActive && viewMode === 'source', 'selectAll', () => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return
    editor.setSelection(model.getFullModelRange())
    editor.focus()
  })

  useEffect(() => {
    if (!focusAnnotationId) return
    const ann = annotations.find((a) => a.id === focusAnnotationId)
    if (!ann) {
      setFocusAnnotationId(null)
      return
    }

    if (viewMode === 'preview') {
      if (ann.selectedText && previewRef.current) {
        scrollToAnnotationText(previewRef.current, ann.selectedText)
      }
      setFocusAnnotationId(null)
      return
    }

    if (!ann.range) {
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
  }, [focusAnnotationId, annotations, viewMode, monacoMounted, setFocusAnnotationId])

  const closeToolbar = (): void => {
    setToolbarRect(null)
    setPendingRange(null)
    setPendingText('')
    clearDomSelection()
    const editor = editorRef.current
    const monaco = monacoRef.current
    const pos = editor?.getPosition()
    if (editor && monaco && pos) {
      editor.setSelection(
        new monaco.Selection(pos.lineNumber, pos.column, pos.lineNumber, pos.column)
      )
    }
  }

  const saveAnnotation = useCallback(
    async (
      type: 'highlight' | 'underline' | 'note',
      noteContent?: string,
      override?: { text?: string; range?: TextRange | null; domRange?: Range | null }
    ): Promise<void> => {
      const text = override?.text ?? pendingText
      const range = override?.range !== undefined ? override.range : pendingRange
      if (!text) return
      const color = resolveMarkupColor(type === 'note' ? 'note' : type)
      await create({
        type,
        color,
        selectedText: text,
        content: noteContent,
        range: range ?? undefined
      })
      closeToolbar()
      setShowNoteModal(false)
    },
    [create, pendingText, pendingRange]
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

  const captureMonacoSelection = useCallback((): void => {
    const tool = useWorkspaceStore.getState().annotationTool
    if (tool === 'pen' || tool === 'rect' || tool === 'eraser') return
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

    if (tool === 'highlight' || tool === 'underline') {
      if (monacoApplyingRef.current) return
      monacoApplyingRef.current = true
      void saveAnnotation(tool, undefined, { text, range }).finally(() => {
        monacoApplyingRef.current = false
      })
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

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || viewMode !== 'source') return
    const disposable = editor.onMouseUp(() => {
      setTimeout(() => captureMonacoSelection(), 10)
    })
    return () => disposable.dispose()
  }, [viewMode, captureMonacoSelection, monacoMounted])

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
        <div ref={bindPreviewHost} className="markdown-preview-host">
          <div
            ref={previewRef}
            className="markdown-preview"
            onContextMenu={blockViewerContextMenu}
          />
        </div>
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
              setMonacoMounted(true)
              const scrollEl = editor
                .getDomNode()
                ?.querySelector('.monaco-scrollable-element') as HTMLElement | null
              monacoSurfaceRef.current = scrollEl
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

      {toolbarRect && annotationTool === 'select' && (
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
