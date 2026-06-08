import {
  ArrowDownWideNarrow,
  Clock,
  Download,
  ListOrdered,
  Pencil,
  Plus,
  Trash2,
  Upload
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DocumentNoteEntry, NoteSortMode } from '@shared/documentNotes'
import { DEFAULT_NOTEBOOK_ID, type Notebook, type NotebookMeta } from '@shared/notebooks'
import { parseNotebookExport, serializeNotebookExport } from '@shared/notebookExport'
import type { SavedDocumentType } from '@shared/readingProgress'
import { resetPageZoom } from '../../utils/pageZoomReset'
import { ConfirmModal, PromptModal } from '../../ui/layout/PromptModal'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import type { DocumentType, OpenDocument } from '../../stores/workspaceStore'
import { captureNoteAnchor } from './captureNoteAnchor'
import {
  collectDeleteTargets,
  deleteEntry,
  getNotebookChildren,
  insertEntryAsChild,
  migrateDepthToParentId,
  nextSortIndexForParent,
  restoreDeletedEntries
} from './documentNoteEntries'
import { isAiNoteAnchor, AI_NOTE_DOC_PATH } from '@shared/aiNoteMarkdown'
import { resolveNoteSortMode } from './documentNoteSort'
import { navigateToNoteEntry, focusNoteEntryInPanelAfterSettle, navigateToAiSession } from './navigateToNoteEntry'
import { useChatStore } from '../../stores/chatStore'
import { NoteComposer } from './NoteComposer'
import { NoteDeleteConfirmModal } from './NoteDeleteConfirmModal'
import { NoteEntryTree } from './NoteEntryTree'
import { NoteUndoBar } from './NoteUndoBar'
import { useNoteTreeDrag } from './useNoteTreeDrag'

const SAVE_DEBOUNCE_MS = 600
const UNDO_MS = 10_000

interface PendingDelete {
  entryId: string
  childCount: number
}

function toSavedDocType(type: DocumentType): SavedDocumentType {
  if (type === 'settings' || type === 'unknown') return 'unknown'
  return type
}

function newEntryId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function entryIdsToExpand(entries: DocumentNoteEntry[], entryId: string): Set<string> {
  const byId = new Map(entries.map((e) => [e.id, e]))
  const ids = new Set<string>([entryId])
  let current = byId.get(entryId)
  while (current?.parentId) {
    ids.add(current.parentId)
    current = byId.get(current.parentId)
  }
  return ids
}

interface DocumentNotePanelProps {
  doc: OpenDocument | null
}

export function DocumentNotePanel({ doc }: DocumentNotePanelProps): JSX.Element {
  const {
    selection,
    noteSortMode,
    setNoteSortMode,
    activeNotebookId,
    setActiveNotebookId,
    dispatchReaderNavigate,
    noteInsertRequest,
    clearNoteInsertRequest,
    noteFocusRequest,
    clearNoteFocusRequest
  } = useWorkspaceStore()

  const [notebookMetas, setNotebookMetas] = useState<NotebookMeta[]>([])
  const [notebook, setNotebook] = useState<Notebook | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inlineInsertAfterId, setInlineInsertAfterId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [createNotebookOpen, setCreateNotebookOpen] = useState(false)
  const [createNotebookError, setCreateNotebookError] = useState<string | null>(null)
  const [renameNotebookOpen, setRenameNotebookOpen] = useState(false)
  const [renameNotebookError, setRenameNotebookError] = useState<string | null>(null)
  const [pendingNotebookDelete, setPendingNotebookDelete] = useState<NotebookMeta | null>(null)
  const [ioFeedback, setIoFeedback] = useState<string | null>(null)
  const [undoBundle, setUndoBundle] = useState<DocumentNoteEntry[] | null>(null)
  const listEndRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notebookRef = useRef<Notebook | null>(null)
  notebookRef.current = notebook

  const effectiveSortMode = resolveNoteSortMode(
    noteSortMode,
    notebook?.defaultSortMode ?? 'manual'
  )

  const rootEntries = useMemo(() => {
    if (!notebook) return []
    return getNotebookChildren(notebook.entries, null, effectiveSortMode)
  }, [effectiveSortMode, notebook])

  const applyMigration = useCallback((nb: Notebook): Notebook => {
    if (!doc) return nb
    return { ...nb, entries: migrateDepthToParentId(nb.entries, doc.path) }
  }, [doc])
  const loadNotebook = useCallback(async (id: string): Promise<void> => {
    const nb = await window.api.notebooks.get(id)
    if (!nb) throw new Error('笔记本不存在')
    setNotebook(doc ? applyMigration(nb) : nb)
    if (!activeNotebookId || activeNotebookId !== id) {
      setActiveNotebookId(id)
    }
  }, [activeNotebookId, applyMigration, doc, setActiveNotebookId])

  const refreshIndex = useCallback(async (): Promise<NotebookMeta[]> => {
    const index = await window.api.notebooks.list()
    setNotebookMetas(index.notebooks)
    return index.notebooks
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void refreshIndex()
      .then(async (metas) => {
        if (cancelled) return
        const targetId =
          activeNotebookId && metas.some((m) => m.id === activeNotebookId)
            ? activeNotebookId
            : metas[0]?.id
        if (!targetId) {
          const created = await window.api.notebooks.create({
            name: '默认笔记本',
            defaultSortMode: 'manual'
          })
          if (cancelled) return
          setNotebookMetas([{ ...created, updatedAt: created.updatedAt }])
          setNotebook(created)
          setActiveNotebookId(created.id)
          return
        }
        await loadNotebook(targetId)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || '无法加载笔记本')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setInlineInsertAfterId(null)
  }, [doc?.path, effectiveSortMode, notebook?.id])

  const flushPendingSave = useCallback(async (): Promise<void> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const pending = notebookRef.current
    if (pending) {
      await window.api.notebooks.save(pending)
    }
  }, [])

  useEffect(() => {
    if (!doc || !notebook) return
    let cancelled = false
    void (async () => {
      await flushPendingSave()
      if (cancelled) return
      let nb = await window.api.notebooks.linkDoc(notebook.id, doc.path)
      if (cancelled) return
      if (notebook.id === DEFAULT_NOTEBOOK_ID) {
        const imported = await window.api.notebooks.importLegacy(notebook.id, doc.path)
        if (cancelled) return
        nb = imported ?? nb
      }
      setNotebook((prev) => {
        if (!prev || prev.id !== nb.id) return applyMigration(nb)
        return applyMigration({
          ...nb,
          entries: prev.entries.length > nb.entries.length ? prev.entries : nb.entries,
          linkedDocPaths: Array.from(new Set([...prev.linkedDocPaths, ...nb.linkedDocPaths]))
        })
      })
    })().catch((err: Error) => {
      if (!cancelled) setError(err.message || '关联文档失败')
    })
    return () => {
      cancelled = true
    }
  }, [applyMigration, doc?.path, flushPendingSave, notebook?.id])

  const scheduleSave = useCallback((next: Notebook): void => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void window.api.notebooks.save(next).catch((err: Error) => {
        setError(err.message || '保存失败')
      })
    }, SAVE_DEBOUNCE_MS)
  }, [])

  const persistNotebook = useCallback(
    (updater: (prev: Notebook) => Notebook): void => {
      setNotebook((prev) => {
        if (!prev) return prev
        const next = updater(prev)
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave]
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      const pending = notebookRef.current
      if (pending) void window.api.notebooks.save(pending)
    }
  }, [])

  const scrollToBottom = useCallback((): void => {
    requestAnimationFrame(() => {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }, [])

  const createEntry = useCallback(
    async (
      bodyMarkdown: string,
      source?: string,
      aiSessionId?: string
    ): Promise<DocumentNoteEntry> => {
      const now = new Date().toISOString()
      if (!notebook) throw new Error('无笔记本')
      if (doc) {
        const anchor = await captureNoteAnchor(
          doc.path,
          toSavedDocType(doc.type),
          doc.name,
          selection
        )
        return {
          id: newEntryId(),
          bodyMarkdown,
          anchor,
          sortIndex: nextSortIndexForParent(notebook.entries, null),
          createdAt: now,
          updatedAt: now,
          collapsed: false
        }
      }
      return {
        id: newEntryId(),
        bodyMarkdown,
        anchor: {
          docPath: AI_NOTE_DOC_PATH,
          docType: 'unknown',
          docName: source ?? 'AI 对话',
          aiSessionId
        },
        sortIndex: nextSortIndexForParent(notebook.entries, null),
        createdAt: now,
        updatedAt: now,
        collapsed: false
      }
    },
    [doc, notebook, selection]
  )

  const handleAdd = useCallback(
    async (bodyMarkdown: string): Promise<void> => {
      if (!notebook || !doc) return
      const entry = await createEntry(bodyMarkdown)
      persistNotebook((prev) => ({
        ...prev,
        entries: [...prev.entries, entry]
      }))
      scrollToBottom()
    },
    [createEntry, doc, persistNotebook, scrollToBottom, notebook]
  )

  useEffect(() => {
    if (!noteInsertRequest || !notebook) return
    const { markdown, source, aiSessionId, seq } = noteInsertRequest
    void (async () => {
      try {
        const entry = await createEntry(markdown, source, aiSessionId)
        persistNotebook((prev) => ({
          ...prev,
          entries: [...prev.entries, entry]
        }))
        scrollToBottom()
        setIoFeedback('已加入笔记')
        window.setTimeout(() => setIoFeedback(null), 2000)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加入笔记失败')
      } finally {
        if (useWorkspaceStore.getState().noteInsertRequest?.seq === seq) {
          clearNoteInsertRequest()
        }
      }
    })()
  }, [
    clearNoteInsertRequest,
    createEntry,
    noteInsertRequest,
    notebook,
    persistNotebook,
    scrollToBottom
  ])

  useEffect(() => {
    if (!noteFocusRequest) return
    const { entryId, notebookId, seq } = noteFocusRequest
    const targetNotebookId = notebookId ?? notebook?.id
    if (!targetNotebookId) {
      clearNoteFocusRequest()
      return
    }

    if (notebook?.id !== targetNotebookId) {
      void flushPendingSave()
        .then(() => loadNotebook(targetNotebookId))
        .catch((err: Error) => {
          setError(err.message || '无法切换笔记本')
          clearNoteFocusRequest()
        })
      return
    }

    if (!notebook) return

    if (!notebook.entries.some((e) => e.id === entryId)) {
      clearNoteFocusRequest()
      return
    }
    const expandIds = entryIdsToExpand(notebook.entries, entryId)
    persistNotebook((prev) => ({
      ...prev,
      entries: prev.entries.map((e) =>
        expandIds.has(e.id) ? { ...e, collapsed: false } : e
      )
    }))
    resetPageZoom()
    focusNoteEntryInPanelAfterSettle(entryId)
    if (useWorkspaceStore.getState().noteFocusRequest?.seq === seq) {
      clearNoteFocusRequest()
    }
  }, [
    clearNoteFocusRequest,
    flushPendingSave,
    loadNotebook,
    noteFocusRequest,
    notebook,
    persistNotebook
  ])

  const handleExportNotebook = useCallback((): void => {
    if (!notebook) return
    void (async () => {
      try {
        const ok = await window.api.dialog.saveJson(
          serializeNotebookExport(notebook),
          `${notebook.name}.json`
        )
        if (ok) {
          setIoFeedback('已导出笔记本')
          window.setTimeout(() => setIoFeedback(null), 2000)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '导出失败')
      }
    })()
  }, [notebook])

  const handleImportNotebook = useCallback((): void => {
    void (async () => {
      try {
        const picked = await window.api.dialog.openJson()
        if (!picked) return
        const parsed = parseNotebookExport(picked.content)
        await flushPendingSave()
        const imported = await window.api.notebooks.importNotebook(parsed)
        await refreshIndex()
        await loadNotebook(imported.id)
        setIoFeedback(`已导入「${imported.name}」`)
        window.setTimeout(() => setIoFeedback(null), 2000)
      } catch (err) {
        setError(err instanceof Error ? err.message : '导入失败')
      }
    })()
  }, [flushPendingSave, loadNotebook, refreshIndex])

  const handleInsertChild = useCallback(
    (parentEntryId: string): void => {
      persistNotebook((prev) => ({
        ...prev,
        entries: prev.entries.map((e) =>
          e.id === parentEntryId ? { ...e, collapsed: false } : e
        )
      }))
      setInlineInsertAfterId((prev) => (prev === parentEntryId ? null : parentEntryId))
    },
    [persistNotebook]
  )

  const handleInsertChildSubmit = useCallback(
    async (parentEntryId: string, bodyMarkdown: string): Promise<void> => {
      if (!notebook || !doc) return
      const entry = await createEntry(bodyMarkdown)
      persistNotebook((prev) => ({
        ...prev,
        entries: insertEntryAsChild(prev.entries, parentEntryId, entry)
      }))
      setInlineInsertAfterId(null)
    },
    [createEntry, doc, persistNotebook, notebook]
  )

  const handleSaveEntry = useCallback(
    (entryId: string, bodyMarkdown: string): void => {
      const now = new Date().toISOString()
      persistNotebook((prev) => ({
        ...prev,
        entries: prev.entries.map((e) =>
          e.id === entryId ? { ...e, bodyMarkdown, updatedAt: now } : e
        )
      }))
    },
    [persistNotebook]
  )

  const clearUndo = useCallback((): void => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    setUndoBundle(null)
  }, [])

  const executeDelete = useCallback(
    (entryId: string): void => {
      if (!notebook) return
      const removed = collectDeleteTargets(notebook.entries, entryId)
      if (removed.length === 0) return
      clearUndo()
      persistNotebook((prev) => ({
        ...prev,
        entries: deleteEntry(prev.entries, entryId)
      }))
      setUndoBundle(removed)
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
      undoTimerRef.current = setTimeout(() => {
        undoTimerRef.current = null
        setUndoBundle(null)
      }, UNDO_MS)
    },
    [clearUndo, notebook, persistNotebook]
  )

  const handleDeleteRequest = useCallback(
    (entryId: string): void => {
      if (!notebook) return
      const entry = notebook.entries.find((e) => e.id === entryId)
      if (!entry) return
      const targets = collectDeleteTargets(notebook.entries, entryId)
      const childCount = Math.max(0, targets.length - 1)
      if (childCount === 0) {
        executeDelete(entryId)
        return
      }
      setPendingDelete({ entryId, childCount })
    },
    [executeDelete, notebook]
  )

  const handleConfirmDelete = useCallback((): void => {
    if (!pendingDelete) return
    executeDelete(pendingDelete.entryId)
    setPendingDelete(null)
  }, [executeDelete, pendingDelete])

  const handleUndo = useCallback((): void => {
    if (!undoBundle) return
    persistNotebook((prev) => ({
      ...prev,
      entries: restoreDeletedEntries(prev.entries, undoBundle)
    }))
    clearUndo()
  }, [clearUndo, persistNotebook, undoBundle])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'z' || e.shiftKey) return
      if (!undoBundle) return
      e.preventDefault()
      handleUndo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleUndo, undoBundle])

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  const persistEntries = useCallback(
    (entries: DocumentNoteEntry[]): void => {
      persistNotebook((prev) => ({ ...prev, entries }))
    },
    [persistNotebook]
  )

  const treeDrag = useNoteTreeDrag(
    effectiveSortMode === 'manual',
    notebook?.entries ?? [],
    persistEntries
  )

  const handleToggleCollapse = useCallback(
    (entryId: string): void => {
      persistNotebook((prev) => ({
        ...prev,
        entries: prev.entries.map((e) =>
          e.id === entryId ? { ...e, collapsed: !e.collapsed } : e
        )
      }))
    },
    [persistNotebook]
  )

  const handleNavigate = useCallback(
    (entry: DocumentNoteEntry): void => {
      if (isAiNoteAnchor(entry.anchor.docPath, entry.anchor.aiSessionId)) {
        if (entry.anchor.aiSessionId) {
          navigateToAiSession(entry.anchor.aiSessionId)
          return
        }
        useWorkspaceStore.getState().openAIPanel()
        useChatStore.getState().setShowHistory(true)
        return
      }
      void navigateToNoteEntry(entry.anchor, dispatchReaderNavigate).catch((err: Error) => {
        setError(err.message || '无法跳转到文档')
      })
    },
    [dispatchReaderNavigate]
  )

  const handleNotebookChange = useCallback(
    (id: string): void => {
      if (id === notebook?.id) return
      setLoading(true)
      setError(null)
      void flushPendingSave()
        .then(() => loadNotebook(id))
        .catch((err: Error) => setError(err.message || '切换笔记本失败'))
        .finally(() => setLoading(false))
    },
    [flushPendingSave, loadNotebook, notebook?.id]
  )

  const handleCreateNotebookOpen = useCallback((): void => {
    setCreateNotebookError(null)
    setCreateNotebookOpen(true)
  }, [])

  const handleCreateNotebookSubmit = useCallback(
    (name: string): void => {
      const trimmed = name.trim()
      if (!trimmed) {
        setCreateNotebookError('笔记本名称不能为空')
        return
      }
      void flushPendingSave()
        .then(() =>
          window.api.notebooks.create({ name: trimmed, defaultSortMode: 'manual' })
        )
        .then(async (created) => {
          await refreshIndex()
          await loadNotebook(created.id)
          setCreateNotebookOpen(false)
          setCreateNotebookError(null)
        })
        .catch((err: Error) => setCreateNotebookError(err.message || '创建失败'))
    },
    [flushPendingSave, loadNotebook, refreshIndex]
  )

  const handleRenameNotebookOpen = useCallback((): void => {
    if (!notebook) return
    setRenameNotebookError(null)
    setRenameNotebookOpen(true)
  }, [notebook])

  const handleRenameNotebookSubmit = useCallback(
    (name: string): void => {
      if (!notebook) return
      const trimmed = name.trim()
      if (!trimmed) {
        setRenameNotebookError('笔记本名称不能为空')
        return
      }
      void flushPendingSave()
        .then(() => window.api.notebooks.rename({ id: notebook.id, name: trimmed }))
        .then(async (updated) => {
          await refreshIndex()
          setNotebook((prev) => (prev?.id === updated.id ? applyMigration(updated) : prev))
          setRenameNotebookOpen(false)
          setRenameNotebookError(null)
        })
        .catch((err: Error) => setRenameNotebookError(err.message || '重命名失败'))
    },
    [applyMigration, flushPendingSave, notebook, refreshIndex]
  )

  const handleDeleteNotebookRequest = useCallback((): void => {
    if (!notebook || notebook.id === DEFAULT_NOTEBOOK_ID) return
    const meta = notebookMetas.find((m) => m.id === notebook.id)
    if (!meta) return
    setPendingNotebookDelete(meta)
  }, [notebook, notebookMetas])

  const handleConfirmDeleteNotebook = useCallback((): void => {
    const target = pendingNotebookDelete
    if (!target) return
    void flushPendingSave()
      .then(() => window.api.notebooks.delete(target.id))
      .then(async () => {
        const metas = await refreshIndex()
        setPendingNotebookDelete(null)
        const fallbackId =
          metas.find((m) => m.id === DEFAULT_NOTEBOOK_ID)?.id ?? metas[0]?.id ?? null
        if (!fallbackId) {
          setNotebook(null)
          return
        }
        await loadNotebook(fallbackId)
      })
      .catch((err: Error) => {
        setPendingNotebookDelete(null)
        setError(err.message || '删除笔记本失败')
      })
  }, [flushPendingSave, loadNotebook, pendingNotebookDelete, refreshIndex])

  const handleSetDefaultSort = useCallback(
    (mode: NoteSortMode): void => {
      if (!notebook) return
      persistNotebook((prev) => ({ ...prev, defaultSortMode: mode }))
      setNoteSortMode(null)
    },
    [notebook, persistNotebook, setNoteSortMode]
  )

  if (loading && !notebook) return <div className="loading-state">加载笔记...</div>
  if (error && !notebook) return <div className="error-state">{error}</div>

  return (
    <div className="doc-note-panel">
      <header className="doc-note-panel-header">
        <div className="doc-note-panel-notebook-row">
          <select
            className="doc-note-notebook-select"
            value={notebook?.id ?? ''}
            aria-label="当前笔记本"
            onChange={(e) => handleNotebookChange(e.target.value)}
          >
            {notebookMetas.map((meta) => (
              <option key={meta.id} value={meta.id}>
                {meta.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="doc-note-notebook-add"
            title="新建笔记本"
            aria-label="新建笔记本"
            onClick={handleCreateNotebookOpen}
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="doc-note-notebook-rename"
            title="重命名当前笔记本"
            aria-label="重命名当前笔记本"
            disabled={!notebook}
            onClick={handleRenameNotebookOpen}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="doc-note-notebook-io"
            title="导出当前笔记本"
            aria-label="导出当前笔记本"
            disabled={!notebook}
            onClick={handleExportNotebook}
          >
            <Download size={14} />
          </button>
          <button
            type="button"
            className="doc-note-notebook-io"
            title="从文件导入笔记本"
            aria-label="从文件导入笔记本"
            onClick={handleImportNotebook}
          >
            <Upload size={14} />
          </button>
          <button
            type="button"
            className="doc-note-notebook-delete"
            title={
              notebook?.id === DEFAULT_NOTEBOOK_ID
                ? '默认笔记本不可删除'
                : '删除当前笔记本'
            }
            aria-label="删除当前笔记本"
            disabled={!notebook || notebook.id === DEFAULT_NOTEBOOK_ID}
            onClick={handleDeleteNotebookRequest}
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="doc-note-panel-title-row">
          <div
            className="doc-note-panel-title"
            title={doc ? doc.path : '打开文档后可在此笔记本下新建笔记'}
          >
            {doc ? `新建笔记关联：${doc.name}` : '查看笔记本全部笔记'}
          </div>
          <div className="doc-note-panel-sort" role="group" aria-label="排序方式">
            <SortButton
              active={effectiveSortMode === 'manual'}
              label="默认"
              icon={ListOrdered}
              onClick={() => setNoteSortMode('manual')}
              onSetDefault={() => handleSetDefaultSort('manual')}
              isDefault={notebook?.defaultSortMode === 'manual'}
            />
            <SortButton
              active={effectiveSortMode === 'history'}
              label="时间"
              icon={Clock}
              onClick={() => setNoteSortMode('history')}
              onSetDefault={() => handleSetDefaultSort('history')}
              isDefault={notebook?.defaultSortMode === 'history'}
            />
            <SortButton
              active={effectiveSortMode === 'document'}
              label="书本"
              icon={ArrowDownWideNarrow}
              onClick={() => setNoteSortMode('document')}
              onSetDefault={() => handleSetDefaultSort('document')}
              isDefault={notebook?.defaultSortMode === 'document'}
            />
          </div>
        </div>
      </header>

      {error && <div className="doc-note-panel-error">{error}</div>}
      {ioFeedback && <div className="doc-note-panel-io-feedback">{ioFeedback}</div>}

      {effectiveSortMode !== 'manual' && rootEntries.length > 0 && (
        <div className="doc-note-panel-sort-hint" role="status">
          <ListOrdered size={13} aria-hidden className="doc-note-panel-sort-hint-icon" />
          <span className="doc-note-panel-sort-hint-text">拖动排序需使用「默认」视图</span>
          <button
            type="button"
            className="doc-note-panel-sort-hint-action"
            onClick={() => setNoteSortMode('manual')}
          >
            切换
          </button>
        </div>
      )}

      <div className="doc-note-panel-list">
        {rootEntries.length === 0 ? (
          <div className="doc-note-panel-placeholder">
            <p>暂无笔记</p>
            <p>
              {doc
                ? '在下方输入内容；点击文档名或位置可跳转到对应页'
                : '打开文档后可新建笔记；已有笔记可点击跳转到对应文档'}
            </p>
          </div>
        ) : (
          <NoteEntryTree
            entries={notebook?.entries ?? []}
            parentId={null}
            sortMode={effectiveSortMode}
            draggable={effectiveSortMode === 'manual'}
            treeDrag={treeDrag}
            inlineInsertAfterId={inlineInsertAfterId}
            depth={0}
            onNavigate={handleNavigate}
            onSave={handleSaveEntry}
            onDeleteRequest={handleDeleteRequest}
            onToggleCollapse={handleToggleCollapse}
            onInsertBelow={handleInsertChild}
            onInsertSubmit={(parentId, md) => void handleInsertChildSubmit(parentId, md)}
            onInsertCancel={() => setInlineInsertAfterId(null)}
            notebookId={notebook?.id}
          />
        )}
        <div ref={listEndRef} />
      </div>

      {undoBundle && undoBundle.length > 0 && (
        <NoteUndoBar
          count={undoBundle.length}
          onUndo={handleUndo}
          onDismiss={clearUndo}
        />
      )}

      <NoteComposer
        disabled={!notebook || !doc}
        placeholder={doc ? undefined : '请先打开参考文档以新建笔记'}
        onSubmit={(md) => void handleAdd(md)}
      />

      {pendingDelete && (
        <NoteDeleteConfirmModal
          childCount={pendingDelete.childCount}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {createNotebookOpen && (
        <PromptModal
          title="新建笔记本"
          label="名称"
          defaultValue="新笔记本"
          placeholder="输入笔记本名称"
          error={createNotebookError ?? undefined}
          onSubmit={handleCreateNotebookSubmit}
          onCancel={() => {
            setCreateNotebookOpen(false)
            setCreateNotebookError(null)
          }}
        />
      )}

      {renameNotebookOpen && notebook && (
        <PromptModal
          title="重命名笔记本"
          label="名称"
          defaultValue={notebook.name}
          placeholder="输入笔记本名称"
          error={renameNotebookError ?? undefined}
          onSubmit={handleRenameNotebookSubmit}
          onCancel={() => {
            setRenameNotebookOpen(false)
            setRenameNotebookError(null)
          }}
        />
      )}

      {pendingNotebookDelete && (
        <ConfirmModal
          title="删除笔记本"
          message={`确定删除「${pendingNotebookDelete.name}」？其中的全部笔记条目将被永久删除，且无法撤销。`}
          onConfirm={handleConfirmDeleteNotebook}
          onCancel={() => setPendingNotebookDelete(null)}
        />
      )}
    </div>
  )
}

interface SortButtonProps {
  active: boolean
  label: string
  icon: typeof Clock
  isDefault: boolean
  onClick: () => void
  onSetDefault: () => void
}

function SortButton({
  active,
  label,
  icon: Icon,
  isDefault,
  onClick,
  onSetDefault
}: SortButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={`doc-note-sort-btn${active ? ' active' : ''}${isDefault ? ' is-default' : ''}`}
      title={isDefault ? `${label}（笔记本默认）` : `${label} · 双击设为默认`}
      onClick={onClick}
      onDoubleClick={(e) => {
        e.preventDefault()
        onSetDefault()
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}
