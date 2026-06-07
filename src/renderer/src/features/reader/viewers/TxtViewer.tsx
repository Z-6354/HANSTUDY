import Editor from '@monaco-editor/react'
import type * as MonacoApi from 'monaco-editor'
import type { editor as MonacoEditor } from 'monaco-editor'
import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveMarkupColor } from '../../../features/reader/annotations/annotationMarkup'
import { monacoRangeToContentRects } from '../../../features/reader/annotations/markupOverlayUtils'
import { useBindAnnotationSurface } from '../../../features/reader/annotations/useBindAnnotationSurface'
import { useRegisterMarkupResolver } from '../../../features/reader/annotations/useRegisterMarkupResolver'
import { NoteInputModal, SelectionToolbar } from '../../../features/reader/annotations/SelectionToolbar'
import { useAnnotations } from '../../../features/reader/annotations/useAnnotations'
import { useMonacoAnnotationToolUndo } from '../../../features/reader/annotations/useAnnotationToolUndo'
import { useViewerCommand } from '../../../features/reader/find/useViewerCommand'
import type { Annotation, TextRange } from '../../../types/global.d'
import { useWorkspaceStore } from '../../../stores/workspaceStore'

interface TxtViewerProps {
  filePath: string
  isActive?: boolean
}

export function TxtViewer({ filePath, isActive = true }: TxtViewerProps): JSX.Element {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toolbarRect, setToolbarRect] = useState<DOMRect | null>(null)
  const [pendingRange, setPendingRange] = useState<TextRange | null>(null)
  const [pendingText, setPendingText] = useState('')
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [monacoMounted, setMonacoMounted] = useState(false)

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof MonacoApi | null>(null)
  const surfaceRef = useRef<HTMLElement | null>(null)
  const monacoApplyingRef = useRef(false)
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bindAnnotationSurface = useBindAnnotationSurface()

  const { annotations, create, remove } = useAnnotations(filePath, isActive)
  const { sendToAI, setSelection, focusAnnotationId, setFocusAnnotationId, annotationTool, closeFindBar } =
    useWorkspaceStore()
  useMonacoAnnotationToolUndo(
    annotations,
    remove,
    () => editorRef.current?.getDomNode() ?? null,
    isActive && monacoMounted
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

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

  const resolveMarkupRects = useCallback(
    (ann: Annotation) => {
      const editor = editorRef.current
      const monaco = monacoRef.current
      const surface = surfaceRef.current
      if (!editor || !monaco || !surface || !ann.range) return []
      return monacoRangeToContentRects(editor, monaco, ann.range, surface)
    },
    [monacoMounted, content]
  )
  useRegisterMarkupResolver(resolveMarkupRects, isActive && monacoMounted)

  useEffect(() => {
    if (!focusAnnotationId) return
    const ann = annotations.find((a) => a.id === focusAnnotationId)
    if (!ann) {
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
    editor.setSelection(
      new monaco.Range(
        ann.range.startLine,
        ann.range.startColumn,
        ann.range.endLine,
        ann.range.endColumn
      )
    )
    setFocusAnnotationId(null)
  }, [focusAnnotationId, annotations, setFocusAnnotationId, monacoMounted])

  useViewerCommand(isActive, 'find', () => {
    editorRef.current?.getAction('actions.find')?.run()
    closeFindBar()
  })

  useViewerCommand(isActive, 'selectAll', () => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return
    editor.setSelection(model.getFullModelRange())
    editor.focus()
  })

  const closeToolbar = (): void => {
    setToolbarRect(null)
    setPendingRange(null)
    setPendingText('')
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
      override?: { text?: string; range?: TextRange | null }
    ): Promise<void> => {
      const text = override?.text ?? pendingText
      const range = override?.range !== undefined ? override.range : pendingRange
      if (!text) return
      await create({
        type,
        color: resolveMarkupColor(type === 'note' ? 'note' : type),
        selectedText: text,
        content: noteContent,
        range: range ?? undefined
      })
      closeToolbar()
      setShowNoteModal(false)
    },
    [create, pendingText, pendingRange]
  )

  const captureSelection = useCallback((): void => {
    if (!isActive) return
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
  }, [filePath, isActive, saveAnnotation, setSelection])

  useEffect(() => {
    if (!monacoMounted) return
    if (!isActive) {
      bindAnnotationSurface(null)
      return
    }
    const scrollEl = editorRef.current
      ?.getDomNode()
      ?.querySelector('.monaco-scrollable-element') as HTMLElement | null
    surfaceRef.current = scrollEl
    bindAnnotationSurface(scrollEl)
  }, [monacoMounted, isActive, content, bindAnnotationSurface])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const disposable = editor.onMouseUp(() => {
      if (selectionTimerRef.current != null) clearTimeout(selectionTimerRef.current)
      selectionTimerRef.current = setTimeout(() => {
        selectionTimerRef.current = null
        captureSelection()
      }, 10)
    })
    return () => {
      disposable.dispose()
      if (selectionTimerRef.current != null) {
        clearTimeout(selectionTimerRef.current)
        selectionTimerRef.current = null
      }
    }
  }, [captureSelection, monacoMounted])

  if (loading) return <div className="loading-state">加载中...</div>
  if (error) return <div className="error-state">{error}</div>

  return (
    <div className="annotated-viewer">
      <Editor
        height="100%"
        language="plaintext"
        value={content}
        theme="vs-light"
        onMount={(editor, monaco) => {
          editorRef.current = editor
          monacoRef.current = monaco
          setMonacoMounted(true)
          const scrollEl = editor
            .getDomNode()
            ?.querySelector('.monaco-scrollable-element') as HTMLElement | null
          surfaceRef.current = scrollEl
          bindAnnotationSurface(scrollEl)
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
          automaticLayout: true,
          mouseWheelZoom: false
        }}
      />

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
          onSubmit={(content) => saveAnnotation('note', content)}
          onCancel={() => setShowNoteModal(false)}
        />
      )}
    </div>
  )
}
