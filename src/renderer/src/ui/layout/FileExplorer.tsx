import { ChevronDown, ChevronRight, FilePlus, Folder, FolderOpen, FolderPlus, Plus, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { IconButton } from '../../components/IconButton'
import { PathTooltipItem } from '../../components/PathTooltipItem'
import type { FileEntry } from '../../types/global.d'
import { webUrlKey } from '@shared/webCrop'
import { isRecordableWebUrl, webDisplayTitle } from '@shared/webLibrary'
import { useWebLibraryStore } from '../../stores/webLibraryStore'
import { useWorkspaceStore, SETTINGS_DOC_PATH } from '../../stores/workspaceStore'
import { FileTypeIcon } from '../../utils/fileIcons'
import { ConfirmModal, PromptModal } from './PromptModal'
import { WebSnapshotsSection } from './WebSnapshotsSection'

interface ContextMenuState {
  x: number
  y: number
  entry: FileEntry | null
  parentDir: string
}

interface FileTreeItemProps {
  entry: FileEntry
  depth: number
  activePath: string | undefined
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void
  refreshKey: number
}

function FileTreeItem({
  entry,
  depth,
  activePath,
  onContextMenu,
  refreshKey
}: FileTreeItemProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileEntry[]>([])
  const { openDocument, documents } = useWorkspaceStore()
  const isOpen = !entry.isDirectory && documents.some((d) => d.path === entry.path)

  const loadChildren = useCallback(async (): Promise<void> => {
    if (!entry.isDirectory) return
    const items = await window.api.fs.listDirectory(entry.path)
    setChildren(items)
  }, [entry.path, entry.isDirectory])

  useEffect(() => {
    if (expanded) loadChildren()
  }, [expanded, loadChildren, refreshKey])

  const handleClick = async (): Promise<void> => {
    if (entry.isDirectory) {
      setExpanded((v) => !v)
      return
    }
    const info = await window.api.fs.getFileInfo(entry.path)
    if (info.supported) {
      openDocument(info)
    }
  }

  return (
    <>
      <button
        className={`file-tree-item ${activePath === entry.path ? 'active' : ''}${isOpen ? ' open-doc' : ''}`}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
        title={entry.path}
      >
        {entry.isDirectory && (
          <span className="tree-chevron">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
        {!entry.isDirectory && <span className="tree-chevron placeholder" />}
        <span className="icon">
          <FileTypeIcon name={entry.name} isDirectory={entry.isDirectory} />
        </span>
        <span className="tree-name">{entry.name}</span>
      </button>
      {expanded &&
        children.map((child) => (
          <FileTreeItem
            key={child.path}
            entry={child}
            depth={depth + 1}
            activePath={activePath}
            onContextMenu={onContextMenu}
            refreshKey={refreshKey}
          />
        ))}
    </>
  )
}

export function FileExplorer(): JSX.Element {
  const {
    rootFolder,
    recentFiles,
    activeDocumentId,
    documents,
    openDocument,
    openWebPage,
    setRootFolder,
    closeDocument,
    closeOtherDocuments
  } = useWorkspaceStore()
  const { history, loaded: webLibraryLoaded, load: loadWebLibrary } = useWebLibraryStore()

  const [entries, setEntries] = useState<FileEntry[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [prompt, setPrompt] = useState<{
    type: 'newFile' | 'newFolder' | 'rename'
    parentDir: string
    entry?: FileEntry
    defaultValue?: string
  } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<FileEntry | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activePath = documents.find((d) => d.id === activeDocumentId)?.path
  const folderName = rootFolder ? rootFolder.split(/[/\\]/).pop() : null

  const refresh = useCallback(async (): Promise<void> => {
    if (!rootFolder) {
      setEntries([])
      return
    }
    const items = await window.api.fs.listDirectory(rootFolder)
    setEntries(items)
    setRefreshKey((k) => k + 1)
  }, [rootFolder])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!webLibraryLoaded) void loadWebLibrary()
  }, [webLibraryLoaded, loadWebLibrary])

  useEffect(() => {
    const closeMenu = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      if (target.closest('.context-menu')) return
      setContextMenu(null)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [])

  const handleOpenFile = async (): Promise<void> => {
    const result = await window.api.dialog.openFile()
    if (result) openDocument(result)
  }

  const handleOpenFolder = async (): Promise<void> => {
    const result = await window.api.dialog.openFolder()
    if (result) setRootFolder(result.path, result.files)
  }

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry): void => {
    e.preventDefault()
    e.stopPropagation()
    const parentDir = entry.isDirectory
      ? entry.path
      : entry.path.replace(/[/\\][^/\\]+$/, '')
    setContextMenu({ x: e.clientX, y: e.clientY, entry, parentDir })
  }

  const handleRootContextMenu = (e: React.MouseEvent): void => {
    if (!rootFolder) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, entry: null, parentDir: rootFolder })
  }

  const handleImportFiles = async (targetDir: string): Promise<void> => {
    if (!targetDir) {
      setError('请先打开文件夹')
      return
    }
    setError(null)
    setContextMenu(null)
    try {
      if (typeof window.api.dialog.importFiles !== 'function') {
        setError('导入功能未加载，请重启应用（关闭后重新 npm run dev）')
        return
      }
      const result = await window.api.dialog.importFiles(targetDir)
      if (result.canceled) return
      const failed = result.imported.filter((f) => f.error)
      const succeeded = result.imported.filter((f) => !f.error)
      if (succeeded.length === 0 && failed.length > 0) {
        setError(`导入失败：${failed[0].error}`)
        return
      }
      if (failed.length > 0) {
        setError(
          `成功 ${succeeded.length} 个，失败 ${failed.length} 个：${failed[0].error}`
        )
      }
      await refresh()
      if (succeeded.length === 1) {
        const info = await window.api.fs.getFileInfo(succeeded[0].path)
        if (info.supported) openDocument(info)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败')
    }
  }

  const runPrompt = async (value: string): Promise<void> => {
    if (!prompt) return
    setError(null)
    try {
      if (prompt.type === 'newFile') {
        const info = await window.api.fs.createFile(prompt.parentDir, value)
        openDocument(info)
      } else if (prompt.type === 'newFolder') {
        await window.api.fs.createFolder(prompt.parentDir, value)
      } else if (prompt.type === 'rename' && prompt.entry) {
        const info = await window.api.fs.rename(prompt.entry.path, value)
        const doc = documents.find((d) => d.path === prompt.entry!.path)
        if (doc) {
          closeDocument(doc.id)
          if (info.supported) openDocument(info)
        }
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setPrompt(null)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!confirmDelete) return
    setError(null)
    try {
      await window.api.fs.delete(confirmDelete.path)
      documents
        .filter((d) => {
          const base = confirmDelete.path
          const sep = base.includes('\\') ? '\\' : '/'
          return d.path === base || d.path.startsWith(base + sep)
        })
        .forEach((d) => closeDocument(d.id))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setConfirmDelete(null)
    }
  }

  return (
    <>
      <div className="sidebar-header">
        <span>资源管理器</span>
        <div className="sidebar-actions">
          <IconButton
            icon={FilePlus}
            label="新建文件"
            disabled={!rootFolder}
            onClick={() =>
              setPrompt({ type: 'newFile', parentDir: rootFolder!, defaultValue: 'untitled.txt' })
            }
          />
          <IconButton
            icon={FolderPlus}
            label="新建文件夹"
            disabled={!rootFolder}
            onClick={() =>
              setPrompt({ type: 'newFolder', parentDir: rootFolder!, defaultValue: '新建文件夹' })
            }
          />
          <IconButton icon={RefreshCw} label="刷新" disabled={!rootFolder} onClick={() => void refresh()} />
          <IconButton icon={Plus} label="打开文件" onClick={() => void handleOpenFile()} />
          <IconButton icon={FolderOpen} label="打开文件夹" onClick={() => void handleOpenFolder()} />
        </div>
      </div>

      {error && <div className="explorer-error">{error}</div>}

      {documents.filter((d) => d.path !== SETTINGS_DOC_PATH).length > 0 && (
        <div className="open-editors-section">
          <div className="sidebar-header">
            <span>已打开</span>
          </div>
          {documents
            .filter((d) => d.path !== SETTINGS_DOC_PATH)
            .map((doc) => (
              <div
                key={doc.id}
                className={`open-editor-item ${doc.id === activeDocumentId ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className="open-editor-label"
                  onClick={() => useWorkspaceStore.getState().setActiveDocument(doc.id)}
                  title={doc.path}
                >
                  <span className="icon">
                    <FileTypeIcon name={doc.name} />
                  </span>
                  <span className="tree-name">{doc.name}</span>
                </button>
                <button
                  type="button"
                  className="open-editor-close"
                  title="关闭"
                  aria-label={`关闭 ${doc.name}`}
                  onClick={() => closeDocument(doc.id)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
        </div>
      )}

      <div className="file-tree" onContextMenu={handleRootContextMenu}>
        {!rootFolder && (
          <div className="explorer-hint">打开文件夹后，右键可导入、新建、删除文件</div>
        )}

        {folderName && (
          <div className="file-tree-item folder-root" style={{ paddingLeft: '12px' }}>
            <span className="tree-chevron">
              <ChevronDown size={12} />
            </span>
            <span className="icon">
              <Folder size={14} />
            </span>
            <span className="tree-name">{folderName}</span>
          </div>
        )}

        {entries.map((entry) => (
          <FileTreeItem
            key={entry.path}
            entry={entry}
            depth={1}
            activePath={activePath}
            onContextMenu={handleContextMenu}
            refreshKey={refreshKey}
          />
        ))}
      </div>

      <WebSnapshotsSection />

      {recentFiles.length > 0 && (
        <div className="recent-section">
          <div className="sidebar-header">
            <span>最近打开</span>
          </div>
          {recentFiles.map((path) => {
            const name = isRecordableWebUrl(path)
              ? webDisplayTitle(
                  history.find((h) => webUrlKey(h.url) === webUrlKey(path))?.title ?? '',
                  path
                )
              : (path.split(/[/\\]/).pop() ?? path)
            return (
              <PathTooltipItem
                key={path}
                path={path}
                className={`file-tree-item ${activePath === path ? 'active' : ''}`}
                onClick={async () => {
                  if (isRecordableWebUrl(path)) {
                    openWebPage(path)
                    return
                  }
                  const info = await window.api.fs.getFileInfo(path)
                  if (info.supported) openDocument(info)
                }}
              >
                <span className="tree-chevron placeholder" />
                <span className="icon">
                  <FileTypeIcon name={name} />
                </span>
                <span className="tree-name">{name}</span>
              </PathTooltipItem>
            )
          })}
        </div>
      )}

      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void handleImportFiles(contextMenu.parentDir)
            }}
          >
            导入文件
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setPrompt({
                type: 'newFile',
                parentDir: contextMenu.parentDir,
                defaultValue: 'untitled.txt'
              })
              setContextMenu(null)
            }}
          >
            新建文件
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setPrompt({
                type: 'newFolder',
                parentDir: contextMenu.parentDir,
                defaultValue: '新建文件夹'
              })
              setContextMenu(null)
            }}
          >
            新建文件夹
          </button>
          {contextMenu.entry && !contextMenu.entry.isDirectory && (
            <>
              {documents.some((d) => d.path === contextMenu.entry!.path) && (
                <>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const doc = documents.find((d) => d.path === contextMenu.entry!.path)
                      if (doc) closeDocument(doc.id)
                      setContextMenu(null)
                    }}
                  >
                    关闭编辑器
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const doc = documents.find((d) => d.path === contextMenu.entry!.path)
                      if (doc) closeOtherDocuments(doc.id)
                      setContextMenu(null)
                    }}
                  >
                    关闭其他编辑器
                  </button>
                </>
              )}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setPrompt({
                    type: 'rename',
                    parentDir: contextMenu.parentDir,
                    entry: contextMenu.entry!,
                    defaultValue: contextMenu.entry!.name
                  })
                  setContextMenu(null)
                }}
              >
                重命名
              </button>
              <button
                type="button"
                className="danger"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setConfirmDelete(contextMenu.entry)
                  setContextMenu(null)
                }}
              >
                删除
              </button>
            </>
          )}
          {contextMenu.entry?.isDirectory && (
            <>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setPrompt({
                    type: 'rename',
                    parentDir: contextMenu.parentDir,
                    entry: contextMenu.entry!,
                    defaultValue: contextMenu.entry!.name
                  })
                  setContextMenu(null)
                }}
              >
                重命名
              </button>
              <button
                type="button"
                className="danger"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setConfirmDelete(contextMenu.entry)
                  setContextMenu(null)
                }}
              >
                删除
              </button>
            </>
          )}
        </div>
      )}

      {prompt && (
        <PromptModal
          title={
            prompt.type === 'newFile'
              ? '新建文件'
              : prompt.type === 'newFolder'
                ? '新建文件夹'
                : '重命名'
          }
          label="名称"
          defaultValue={prompt.defaultValue}
          onSubmit={runPrompt}
          onCancel={() => setPrompt(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="确认删除"
          message={`确定删除「${confirmDelete.name}」吗？此操作不可撤销。`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  )
}
