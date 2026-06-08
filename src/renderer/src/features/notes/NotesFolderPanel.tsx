import { ChevronDown, ChevronRight, FilePlus, FolderPlus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { IconButton } from '../../components/IconButton'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import type { NoteEntry } from '../../types/global.d'
import { ConfirmModal, PromptModal } from '../../ui/layout/PromptModal'

interface NotesTreeItemProps {
  entry: NoteEntry
  depth: number
  activePath: string | null
  refreshKey: number
  onSelect: (path: string) => void
}

function NotesTreeItem({
  entry,
  depth,
  activePath,
  refreshKey,
  onSelect
}: NotesTreeItemProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<NoteEntry[]>([])

  const loadChildren = useCallback(async (): Promise<void> => {
    if (!entry.isDirectory) return
    const items = await window.api.notes.list(entry.path)
    setChildren(items)
  }, [entry.path, entry.isDirectory])

  useEffect(() => {
    if (expanded) void loadChildren()
  }, [expanded, loadChildren, refreshKey])

  const handleClick = (): void => {
    if (entry.isDirectory) {
      setExpanded((v) => !v)
      return
    }
    onSelect(entry.path)
  }

  return (
    <>
      <button
        type="button"
        className={`file-tree-item ${activePath === entry.path ? 'active' : ''}`}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={handleClick}
        title={entry.path}
      >
        {entry.isDirectory && (
          <span className="tree-chevron">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
        {!entry.isDirectory && <span className="tree-chevron placeholder" />}
        <span className="icon">{entry.isDirectory ? '📁' : '📝'}</span>
        <span className="tree-name">{entry.name.replace(/\.md$/, '')}</span>
      </button>
      {expanded &&
        children.map((child) => (
          <NotesTreeItem
            key={child.path}
            entry={child}
            depth={depth + 1}
            activePath={activePath}
            refreshKey={refreshKey}
            onSelect={onSelect}
          />
        ))}
    </>
  )
}

export function NotesFolderPanel(): JSX.Element {
  const { activeNotePath, setActiveNotePath, setWorkbenchMode } = useWorkspaceStore()
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [entries, setEntries] = useState<NoteEntry[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [prompt, setPrompt] = useState<{ kind: 'file' | 'folder'; parent: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<NoteEntry | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const root = await window.api.notes.getRoot()
      setRootPath(root)
      const items = await window.api.notes.list(root)
      setEntries(items)
      setRefreshKey((k) => k + 1)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载笔记库失败')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleSelect = (path: string): void => {
    setActiveNotePath(path)
    setWorkbenchMode('compose')
  }

  const handleCreate = async (name: string): Promise<void> => {
    if (!prompt || !name.trim()) return
    try {
      const parent = prompt.parent || rootPath || (await window.api.notes.getRoot())
      const path =
        prompt.kind === 'folder'
          ? await window.api.notes.createFolder(parent, name.trim())
          : await window.api.notes.createFile(parent, name.trim())
      await refresh()
      if (prompt.kind === 'file') {
        setActiveNotePath(path)
        setWorkbenchMode('compose')
      }
      setPrompt(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!confirmDelete) return
    try {
      await window.api.notes.delete(confirmDelete.path)
      if (activeNotePath === confirmDelete.path) setActiveNotePath(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setConfirmDelete(null)
    }
  }

  return (
    <div className="notes-folder-panel">
      <div className="notes-panel-toolbar">
        <div className="notes-panel-actions">
          <IconButton
            icon={FilePlus}
            label="新建笔记"
            size={16}
            onClick={() => setPrompt({ kind: 'file', parent: rootPath ?? '' })}
          />
          <IconButton
            icon={FolderPlus}
            label="新建文件夹"
            size={16}
            onClick={() => setPrompt({ kind: 'folder', parent: rootPath ?? '' })}
          />
          <IconButton icon={RefreshCw} label="刷新" size={16} onClick={() => void refresh()} />
        </div>
      </div>

      {error && <p className="notes-panel-error">{error}</p>}

      <div className="notes-tree">
        {entries.map((entry) => (
          <NotesTreeItem
            key={entry.path}
            entry={entry}
            depth={0}
            activePath={activeNotePath}
            refreshKey={refreshKey}
            onSelect={handleSelect}
          />
        ))}
        {entries.length === 0 && <p className="notes-panel-empty">暂无笔记，点击 + 创建</p>}
      </div>

      {prompt && (
        <PromptModal
          title={prompt.kind === 'folder' ? '新建文件夹' : '新建笔记'}
          label={prompt.kind === 'folder' ? '文件夹名称' : '笔记标题'}
          placeholder={prompt.kind === 'folder' ? '文件夹名称' : '笔记标题'}
          onSubmit={handleCreate}
          onCancel={() => setPrompt(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="删除"
          message={`确定删除「${confirmDelete.name}」？`}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
