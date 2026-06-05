import Editor, { Monaco } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAnnotationSurface } from '../annotations/AnnotationSurfaceContext'
import { NoteInputModal, SelectionToolbar } from '../annotations/SelectionToolbar'
import { useAnnotations } from '../annotations/useAnnotations'
import type { TextRange } from '../types/global.d'
import { useWorkspaceStore } from '../stores/workspaceStore'

interface TxtViewerProps {
  filePath: string
}

const HIGHLIGHT_COLOR = '#ffd50055'
const UNDERLINE_COLOR = '#007acc'

export function TxtViewer({ filePath }: TxtViewerProps): JSX.Element {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toolbarRect, setToolbarRect] = useState<DOMRect | null>(null)
  const [pendingRange, setPendingRange] = useState<TextRange | null>(null)
  const [pendingText, setPendingText] = useState('')
  const [showNoteModal, setShowNoteModal] = useState(false)

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const decorationIdsRef = useRef<string[]>([])
  const [scrollSurface, setScrollSurface] = useState<HTMLElement | null>(null)

  useAnnotationSurface(scrollSurface)

  const { annotations, create } = useAnnotations(filePath)
  const { sendToAI, setSelection, focusAnnotationId, setFocusAnnotationId } = useWorkspaceStore()

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
    applyDecorations()
  }, [applyDecorations, content])

  useEffect(() => {
    if (!focusAnnotationId) return
    const ann = annotations.find((a) => a.id === focusAnnotationId)
    if (!ann?.range) return
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
  }, [focusAnnotationId, annotations, setFocusAnnotationId])

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
      closeToolbar()
      setShowNoteModal(false)
    },
    [create, pendingText, pendingRange]
  )

  const captureSelection = useCallback((): void => {
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
          const scrollEl = editor
            .getDomNode()
            ?.querySelector('.monaco-scrollable-element') as HTMLElement | null
          setScrollSurface(scrollEl)
          editor.onMouseUp(() => {
            setTimeout(() => captureSelection(), 10)
          })
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
          onSubmit={(content) => saveAnnotation('note', content)}
          onCancel={() => setShowNoteModal(false)}
        />
      )}
    </div>
  )
}
