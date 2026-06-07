import Editor from '@monaco-editor/react'
import { Eye, Code } from 'lucide-react'
import { IconButton } from '../../../components/IconButton'
import type * as MonacoApi from 'monaco-editor'
import type { editor as MonacoEditor } from 'monaco-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SelectionToolbar } from '../selection/SelectionToolbar'
import {
  useDomTextSelection,
  useSelectionToolbarEffect
} from '../selection/useDomTextSelection'
import { useDomFind } from '../find/useDomFind'
import { useViewerCommand } from '../find/useViewerCommand'
import { selectAllInElement } from '../find/domFind'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { TextDocumentShell } from './TextDocumentShell'
import { useLazyTextFile } from './useLazyTextFile'
import { buildMdPreviewHtml } from './mdPreview'
import { parseMdOutline } from './textOutline'
import { scrollElementIntoScrollParent } from './pdfViewerPerf'
import { useDeferredOutline } from './useDeferredOutline'
import { defineHanstudyEditorTheme, HANSTUDY_EDITOR_THEME } from './monacoTheme'
import { MD_SOURCE_EDITOR_OPTIONS } from './monacoEditorOptions'
import { useMonacoHeight } from './useMonacoHeight'
import { useMonacoEditorDispose } from './useMonacoEditorDispose'

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

export function MdViewer({ filePath, isActive = true }: MdViewerProps): JSX.Element {
  const { content, isLargeFile, loading, error, dirty, setContent } = useLazyTextFile(filePath, {
    autoSave: true,
    flushOnUnmount: true
  })
  const [viewMode, setViewMode] = useState<MdViewMode>(() => loadViewMode(filePath))
  const [currentLine, setCurrentLine] = useState(1)
  const [toolbarRect, setToolbarRect] = useState<DOMRect | null>(null)
  const [pendingText, setPendingText] = useState('')
  const [monacoMounted, setMonacoMounted] = useState(false)

  const previewRef = useRef<HTMLDivElement>(null)
  const editorRef = useMonacoEditorDispose()
  const sourceSurfaceRef = useRef<HTMLElement | null>(null)
  const { containerRef: editorContainerRef, height: monacoHeight } = useMonacoHeight()

  const { sendToAI, setSelection, closeFindBar } = useWorkspaceStore()

  const outlineItems = useDeferredOutline(
    content,
    parseMdOutline,
    !loading && Boolean(content),
    isLargeFile
  )

  const previewHtml = useMemo(() => {
    if (viewMode !== 'preview' || !content) return ''
    return buildMdPreviewHtml(content)
  }, [content, viewMode])

  const { selection: previewDomSelection, clearSelection: clearPreviewSelection } =
    useDomTextSelection(
      filePath,
      previewRef,
      isActive && viewMode === 'preview' && !loading
    )

  const sourceSelectionEnabled = isActive && viewMode === 'source' && monacoMounted
  const { selection: sourceDomSelection, clearSelection: clearSourceSelection } =
    useDomTextSelection(filePath, sourceSurfaceRef, sourceSelectionEnabled)

  const activeDomSelection = viewMode === 'preview' ? previewDomSelection : sourceDomSelection

  useSelectionToolbarEffect(activeDomSelection, setSelection, setToolbarRect, setPendingText)

  useEffect(() => {
    setViewMode(loadViewMode(filePath))
    setCurrentLine(1)
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
        setToolbarRect(null)
        setPendingText('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filePath])

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

  const closeToolbar = (): void => {
    setToolbarRect(null)
    setPendingText('')
    clearPreviewSelection()
    clearSourceSelection()
  }

  const switchMode = (mode: MdViewMode): void => {
    setViewMode(mode)
    saveViewMode(filePath, mode)
    closeToolbar()
  }

  const navigateToLine = useCallback(
    (line: number): void => {
      setCurrentLine(line)
      if (viewMode === 'preview') {
        const target = previewRef.current?.querySelector<HTMLElement>(`#outline-line-${line}`)
        if (target) scrollElementIntoScrollParent(target, 16)
      } else {
        const editor = editorRef.current
        editor?.revealLineInCenter(line)
        editor?.setPosition({ lineNumber: line, column: 1 })
        editor?.focus()
      }
    },
    [viewMode]
  )

  const handleEditorMount = useCallback(
    (editor: MonacoEditor.IStandaloneCodeEditor, monaco: typeof MonacoApi): void => {
      defineHanstudyEditorTheme(monaco)
      editorRef.current = editor
      sourceSurfaceRef.current = editor.getDomNode()
      setMonacoMounted(true)
      closeFindBar()

      editor.onDidChangeCursorPosition((e) => {
        setCurrentLine(e.position.lineNumber)
      })
    },
    [closeFindBar]
  )

  if (loading) {
    return (
      <div className="loading-state">
        {isLargeFile ? '加载大文件…' : '加载 Markdown…'}
      </div>
    )
  }
  if (error) return <div className="error-state">{error}</div>

  const toolbar = (
    <div className="viewer-toolbar text-doc-toolbar">
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
          label="源码"
          className={`view-mode-btn ${viewMode === 'source' ? 'active' : ''}`}
          active={viewMode === 'source'}
          onClick={() => switchMode('source')}
        />
      </div>
      <span className="viewer-toolbar-hint">
        Ctrl+Shift+V 切换 · 可直接编辑 · 选中文本 Ask AI
        {isLargeFile ? ' · 大文件已启用懒加载' : ''}
      </span>
    </div>
  )

  const saveHint = dirty ? (
    <span className="text-doc-save-hint">保存中…</span>
  ) : (
    <span className="text-doc-save-hint saved">已保存</span>
  )

  return (
    <div className="text-viewer-root">
      <TextDocumentShell
        outlineItems={outlineItems}
        currentLine={currentLine}
        onNavigateLine={navigateToLine}
        toolbar={toolbar}
        saveHint={saveHint}
      >
        {viewMode === 'preview' ? (
          <div className="markdown-preview-host">
            <div
              ref={previewRef}
              className="markdown-preview"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        ) : (
          <div ref={editorContainerRef} className="md-source-editor monaco-editor-host">
            {monacoHeight > 0 ? (
              <Editor
                key={filePath}
                height={monacoHeight}
                language="markdown"
                value={content}
                theme={HANSTUDY_EDITOR_THEME}
                onChange={(value) => setContent(value ?? '')}
                onMount={handleEditorMount}
                options={{
                  ...MD_SOURCE_EDITOR_OPTIONS,
                  readOnly: false,
                  largeFileOptimizations: isLargeFile
                }}
              />
            ) : (
              <div className="loading-state">准备编辑器…</div>
            )}
          </div>
        )}
      </TextDocumentShell>

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
