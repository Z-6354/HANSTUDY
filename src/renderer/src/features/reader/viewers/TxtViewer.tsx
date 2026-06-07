import Editor from '@monaco-editor/react'
import { ChevronLeft, ChevronRight, Pencil, Save, ZoomIn, ZoomOut } from 'lucide-react'
import type * as MonacoApi from 'monaco-editor'
import type { editor as MonacoEditor } from 'monaco-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconButton } from '../../../components/IconButton'
import { SelectionToolbar } from '../selection/SelectionToolbar'
import {
  useDomTextSelection,
  useSelectionToolbarEffect
} from '../selection/useDomTextSelection'
import { useViewerCommand } from '../find/useViewerCommand'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { TextDocumentShell } from './TextDocumentShell'
import { useLazyTextFile } from './useLazyTextFile'
import {
  buildTxtChapters,
  chapterIndexForLine,
  outlineItemsFromChapters
} from './textChapters'
import { formatChapterContent, isChapterTitleLike } from './txtChapterFormat'
import { TextChapterThumbnailPanel } from './TextChapterThumbnailPanel'
import { defineHanstudyEditorTheme, HANSTUDY_EDITOR_THEME } from './monacoTheme'
import { TXT_SOURCE_EDITOR_OPTIONS } from './monacoEditorOptions'
import { useMonacoHeight } from './useMonacoHeight'
import { useMonacoEditorDispose } from './useMonacoEditorDispose'
import { useTxtChapterWheelNav, type ChapterScrollAnchor } from './useTxtChapterWheelNav'
import { useTxtZoom } from './useTxtZoom'

interface TxtViewerProps {
  filePath: string
  isActive?: boolean
}

export function TxtViewer({ filePath, isActive = true }: TxtViewerProps): JSX.Element {
  const { content, isLargeFile, loading, error, dirty, saving, setContent, save, revert } =
    useLazyTextFile(filePath)
  const [editMode, setEditMode] = useState(false)
  const [currentChapter, setCurrentChapter] = useState(0)
  const [toolbarRect, setToolbarRect] = useState<DOMRect | null>(null)
  const [pendingText, setPendingText] = useState('')
  const [monacoMounted, setMonacoMounted] = useState(false)

  const chapterScrollRef = useRef<HTMLDivElement>(null)
  const chapterBodyRef = useRef<HTMLDivElement>(null)
  const readerRef = useRef<HTMLElement>(null)
  const editorHostRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useMonacoEditorDispose()
  const sourceSurfaceRef = useRef<HTMLElement | null>(null)
  const { containerRef: setEditorContainerNode, height: monacoHeight } = useMonacoHeight()

  const bindEditorContainerRef = useCallback(
    (node: HTMLDivElement | null): void => {
      editorHostRef.current = node
      setEditorContainerNode(node)
    },
    [setEditorContainerNode]
  )

  const { sendToAI, setSelection, closeFindBar } = useWorkspaceStore()

  const { bindZoomLabelRef, zoomIn, zoomOut, flushPendingZoom, initialMonacoFontSize } = useTxtZoom({
    filePath,
    editMode,
    editorRef,
    readerRef,
    editorHostRef,
    isActive,
    wheelHostRef: contentRef
  })

  const chapters = useMemo(() => buildTxtChapters(content), [content])
  const outlineItems = useMemo(() => outlineItemsFromChapters(chapters), [chapters])
  const activeChapter = chapters[currentChapter] ?? chapters[0]
  const chapterBlocks = useMemo(
    () =>
      activeChapter
        ? formatChapterContent(activeChapter.title, activeChapter.content)
        : [],
    [activeChapter]
  )

  const selectionEnabled =
    isActive && !loading && (editMode ? monacoMounted : Boolean(chapterBodyRef.current))
  const { selection: domSelection, clearSelection } = useDomTextSelection(
    filePath,
    editMode ? sourceSurfaceRef : chapterBodyRef,
    selectionEnabled
  )

  useSelectionToolbarEffect(domSelection, setSelection, setToolbarRect, setPendingText)

  useEffect(() => {
    setEditMode(false)
    setCurrentChapter(0)
  }, [filePath])

  useEffect(() => {
    if (currentChapter >= chapters.length && chapters.length > 0) {
      setCurrentChapter(0)
    }
  }, [chapters.length, currentChapter])

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly: !editMode })
  }, [editMode])

  useViewerCommand(isActive && editMode, 'find', () => {
    editorRef.current?.getAction('actions.find')?.run()
    closeFindBar()
  })

  useViewerCommand(isActive && editMode, 'selectAll', () => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return
    editor.setSelection(model.getFullModelRange())
    editor.focus()
  })

  const closeToolbar = (): void => {
    setToolbarRect(null)
    setPendingText('')
    clearSelection()
  }

  const exitEditMode = useCallback((): void => {
    if (dirty) revert()
    setEditMode(false)
    closeToolbar()
  }, [dirty, revert])

  const toggleEditMode = useCallback((): void => {
    if (editMode) {
      exitEditMode()
      return
    }
    setEditMode(true)
  }, [editMode, exitEditMode])

  const handleSave = useCallback(async (): Promise<void> => {
    const ok = await save()
    if (ok) setEditMode(false)
  }, [save])

  const goToChapter = useCallback(
    (index: number, anchor: ChapterScrollAnchor = 'top'): void => {
      flushPendingZoom()
      const next = Math.max(0, Math.min(index, chapters.length - 1))
      setCurrentChapter(next)
      if (editMode) {
        const line = chapters[next]?.startLine ?? 1
        const editor = editorRef.current
        editor?.revealLineInCenter(line)
        editor?.setPosition({ lineNumber: line, column: 1 })
        editor?.focus()
        return
      }
      requestAnimationFrame(() => {
        const el = chapterScrollRef.current
        if (!el) return
        el.scrollTop = anchor === 'bottom' ? el.scrollHeight : 0
      })
    },
    [chapters, editMode, flushPendingZoom]
  )

  useTxtChapterWheelNav({
    hostRef: chapterScrollRef,
    enabled: isActive && !editMode && !loading && chapters.length > 1,
    currentChapter,
    chapterCount: chapters.length,
    onChapterChange: goToChapter
  })

  const navigateToLine = useCallback(
    (line: number): void => {
      goToChapter(chapterIndexForLine(chapters, line))
    },
    [chapters, goToChapter]
  )

  const handleEditorMount = useCallback(
    (editor: MonacoEditor.IStandaloneCodeEditor, monaco: typeof MonacoApi): void => {
      defineHanstudyEditorTheme(monaco)
      editorRef.current = editor
      sourceSurfaceRef.current = editor.getDomNode()
      setMonacoMounted(true)
      closeFindBar()
      editor.updateOptions({ readOnly: true, fontSize: initialMonacoFontSize })
    },
    [closeFindBar, initialMonacoFontSize]
  )

  if (loading) {
    return <div className="loading-state">{isLargeFile ? '加载大文件…' : '加载中…'}</div>
  }
  if (error) return <div className="error-state">{error}</div>

  const toolbar = (
    <div className="viewer-toolbar text-doc-toolbar">
      {!editMode && chapters.length > 1 && (
        <div className="txt-chapter-nav-inline">
          <IconButton
            icon={ChevronLeft}
            label="上一章"
            disabled={currentChapter <= 0}
            onClick={() => goToChapter(currentChapter - 1)}
          />
          <span className="txt-chapter-indicator">
            第 {currentChapter + 1} / {chapters.length} 章
          </span>
          <IconButton
            icon={ChevronRight}
            label="下一章"
            disabled={currentChapter >= chapters.length - 1}
            onClick={() => goToChapter(currentChapter + 1)}
          />
        </div>
      )}
      <div className="txt-zoom-controls">
        <IconButton icon={ZoomOut} label="缩小" onClick={zoomOut} />
        <span ref={bindZoomLabelRef} className="txt-zoom-label" />
        <IconButton icon={ZoomIn} label="放大" onClick={zoomIn} />
      </div>
      <span className="viewer-toolbar-hint">
        {editMode
          ? '编辑模式 · 修改后点击保存 · Ctrl+滚轮缩放'
          : chapters.length > 1
            ? '滑动到底/顶可切换章节 · Ctrl+滚轮缩放 · 只读'
            : '只读 · Ctrl+滚轮缩放 · 点击「编辑」后可修改'}
        {isLargeFile ? ' · 大文件已启用懒加载' : ''}
        {' · 选中文本 Ask AI'}
      </span>
    </div>
  )

  const headerActions = (
    <>
      <button
        type="button"
        className={`text-doc-action-btn${editMode ? ' active' : ''}`}
        onClick={toggleEditMode}
        title={editMode ? '退出编辑' : '进入编辑'}
      >
        <Pencil size={14} aria-hidden />
        <span>{editMode ? '退出编辑' : '编辑'}</span>
      </button>
      <button
        type="button"
        className="text-doc-action-btn primary"
        disabled={!editMode || !dirty || saving}
        onClick={() => void handleSave()}
        title="保存"
      >
        <Save size={14} aria-hidden />
        <span>{saving ? '保存中…' : '保存'}</span>
      </button>
    </>
  )

  return (
    <div className="text-viewer-root">
      <TextDocumentShell
        contentRef={contentRef}
        outlineItems={outlineItems}
        currentLine={activeChapter?.startLine ?? 1}
        currentChapter={currentChapter}
        onNavigateLine={navigateToLine}
        onNavigateChapter={goToChapter}
        onSidePanelHoverStart={flushPendingZoom}
        showOutlineLineNumbers={false}
        renderThumbPanel={(open) => (
          <TextChapterThumbnailPanel
            chapters={chapters}
            currentChapter={currentChapter}
            open={open}
            onNavigate={goToChapter}
          />
        )}
        toolbar={toolbar}
        headerActions={headerActions}
      >
        {editMode ? (
          <div ref={bindEditorContainerRef} className="txt-source-editor monaco-editor-host">
            {monacoHeight > 0 ? (
              <Editor
                key={filePath}
                height={monacoHeight}
                defaultLanguage="plaintext"
                value={content}
                theme={HANSTUDY_EDITOR_THEME}
                onChange={(value) => {
                  if (editMode) setContent(value ?? '')
                }}
                onMount={handleEditorMount}
                options={{
                  ...TXT_SOURCE_EDITOR_OPTIONS,
                  readOnly: !editMode,
                  fontSize: initialMonacoFontSize,
                  largeFileOptimizations: isLargeFile
                }}
              />
            ) : (
              <div className="loading-state">准备编辑器…</div>
            )}
          </div>
        ) : (
          <div ref={chapterScrollRef} className="txt-chapter-reader-host">
            <article ref={readerRef} className="txt-chapter-reader">
              <header
                className={`txt-chapter-reader-header${
                  isChapterTitleLike(activeChapter?.title ?? '') ? ' txt-chapter-reader-header--book' : ''
                }`}
              >
                <h2 className="txt-chapter-reader-title">{activeChapter?.title ?? '全文'}</h2>
              </header>
              <div ref={chapterBodyRef} className="txt-chapter-reader-body">
                {chapterBlocks.map((block, index) => {
                  if (block.type === 'blank') {
                    return <div key={`b-${index}`} className="txt-block txt-block--blank" aria-hidden />
                  }
                  if (block.type === 'paragraph') {
                    return (
                      <p key={`p-${index}`} className="txt-block txt-block--paragraph">
                        {block.text}
                      </p>
                    )
                  }
                  return (
                    <div key={`h-${index}`} className={`txt-block txt-block--${block.type}`}>
                      {block.text}
                    </div>
                  )
                })}
              </div>
            </article>
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
