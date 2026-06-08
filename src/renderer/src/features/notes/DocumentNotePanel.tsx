import {
  ArrowDownWideNarrow,
  Clock,
  ListOrdered,
  Plus
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DocumentNoteEntry, NoteSortMode } from '@shared/documentNotes'
import type { Notebook, NotebookMeta } from '@shared/notebooks'
import type { SavedDocumentType } from '@shared/readingProgress'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import type { DocumentType, OpenDocument } from '../../stores/workspaceStore'
import { captureNoteAnchor } from './captureNoteAnchor'
import {
  collectDeleteTargets,
  deleteEntry,
  getChildren,
  insertEntryAsChild,
  migrateDepthToParentId,
  nextSortIndex,
  restoreDeletedEntries
} from './documentNoteEntries'
import { resolveNoteSortMode } from './documentNoteSort'
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
    dispatchReaderNavigate
  } = useWorkspaceStore()

  const [notebookMetas, setNotebookMetas] = useState<NotebookMeta[]>([])
  const [notebook, setNotebook] = useState<Notebook | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inlineInsertAfterId, setInlineInsertAfterId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
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
    if (!notebook || !doc) return []
    return getChildren(notebook.entries, doc.path, null, effectiveSortMode)
  }, [doc, effectiveSortMode, notebook])

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

  useEffect(() => {
    if (!doc || !notebook) return
    let cancelled = false
    void (async () => {
      let nb = await window.api.notebooks.linkDoc(notebook.id, doc.path)
      if (cancelled) return
      const imported = await window.api.notebooks.importLegacy(notebook.id, doc.path)
      if (cancelled) return
      nb = imported ?? nb
      setNotebook(applyMigration(nb))
    })().catch((err: Error) => {
      if (!cancelled) setError(err.message || '关联文档失败')
    })
    return () => {
      cancelled = true
    }
  }, [applyMigration, doc?.path, notebook?.id])

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
    async (bodyMarkdown: string): Promise<DocumentNoteEntry> => {
      if (!doc || !notebook) throw new Error('无文档或笔记本')
      const anchor = await captureNoteAnchor(doc.path, toSavedDocType(doc.type), selection)
      const now = new Date().toISOString()
      return {
        id: newEntryId(),
        bodyMarkdown,
        anchor,
        sortIndex: nextSortIndex(notebook.entries, doc.path, null),
        createdAt: now,
        updatedAt: now,
        collapsed: false
      }
    },
    [doc, notebook, selection]
  )

  const handleAdd = useCallback(
    async (bodyMarkdown: string): Promise<void> => {
      if (!notebook) return
      const entry = await createEntry(bodyMarkdown)
      persistNotebook((prev) => ({
        ...prev,
        entries: [...prev.entries, entry]
      }))
      scrollToBottom()
    },
    [createEntry, persistNotebook, scrollToBottom, notebook]
  )

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
    doc?.path ?? '',
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
      dispatchReaderNavigate(entry.anchor)
    },
    [dispatchReaderNavigate]
  )

  const handleNotebookChange = useCallback(
    (id: string): void => {
      setLoading(true)
      setError(null)
      void loadNotebook(id)
        .catch((err: Error) => setError(err.message || '切换笔记本失败'))
        .finally(() => setLoading(false))
    },
    [loadNotebook]
  )

  const handleCreateNotebook = useCallback((): void => {
    const name = window.prompt('笔记本名称', '新笔记本')
    if (!name?.trim()) return
    void window.api.notebooks
      .create({ name: name.trim(), defaultSortMode: 'manual' })
      .then(async (created) => {
        await refreshIndex()
        setNotebook(created)
        setActiveNotebookId(created.id)
      })
      .catch((err: Error) => setError(err.message || '创建失败'))
  }, [refreshIndex, setActiveNotebookId])

  const handleSetDefaultSort = useCallback(
    (mode: NoteSortMode): void => {
      if (!notebook) return
      persistNotebook((prev) => ({ ...prev, defaultSortMode: mode }))
      setNoteSortMode(null)
    },
    [notebook, persistNotebook, setNoteSortMode]
  )

  if (!doc) {
    return (
      <div className="doc-note-panel-empty">
        <p>请先打开一份文档</p>
        <p className="doc-note-panel-hint">笔记保存在笔记本中，按当前文档筛选显示</p>
      </div>
    )
  }

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
            onClick={handleCreateNotebook}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="doc-note-panel-title-row">
          <div className="doc-note-panel-title" title={doc.path}>
            {doc.name}
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

      {effectiveSortMode !== 'manual' && rootEntries.length > 0 && (
        <p className="doc-note-panel-hint">切换到「默认」排序后可按住拖动调整顺序</p>
      )}

      <div className="doc-note-panel-list">
        {rootEntries.length === 0 ? (
          <div className="doc-note-panel-placeholder">
            <p>暂无笔记</p>
            <p>在下方输入内容；默认排序下按住笔记拖动，可嵌套或调整顺序</p>
          </div>
        ) : (
          <NoteEntryTree
            entries={notebook?.entries ?? []}
            docPath={doc.path}
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

      <NoteComposer disabled={!notebook} onSubmit={(md) => void handleAdd(md)} />

      {pendingDelete && (
        <NoteDeleteConfirmModal
          childCount={pendingDelete.childCount}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
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
