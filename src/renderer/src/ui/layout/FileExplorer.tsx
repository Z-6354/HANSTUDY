import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  Library,
  Plus,
  RefreshCw,
  Star,
  Upload,
  X
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { IconButton } from '../../components/IconButton'
import { PathTooltipItem } from '../../components/PathTooltipItem'
import { TreeReadTimeBadge } from '../../components/TreeReadTimeBadge'
import type { FileEntry } from '../../types/global.d'
import { webUrlKey } from '@shared/webCrop'
import { isRecordableWebUrl, webDisplayTitle } from '@shared/webLibrary'
import type { AppEnvironmentInfo } from '@shared/appEnvironment'
import { useWebLibraryStore } from '../../stores/webLibraryStore'
import { useWorkspaceStore, SETTINGS_DOC_PATH } from '../../stores/workspaceStore'
import { FileTypeIcon } from '../../utils/fileIcons'
import { sortFileEntries } from '../../utils/fileExplorerSort'
import { pathKey } from '../../utils/pathKey'
import { ConfirmModal, PromptModal } from './PromptModal'

function pathsEqual(a: string, b: string): boolean {
  return a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase()
}

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
  favoritePaths: ReadonlySet<string>
  readingAtByPath: ReadonlyMap<string, string>
  onToggleFavorite: (path: string) => void
}

function FileTreeItem({
  entry,
  depth,
  activePath,
  onContextMenu,
  refreshKey,
  favoritePaths,
  readingAtByPath,
  onToggleFavorite
}: FileTreeItemProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileEntry[]>([])
  const { openDocument, documents } = useWorkspaceStore()
  const isOpen = !entry.isDirectory && documents.some((d) => d.path === entry.path)
  const isFavorite = !entry.isDirectory && favoritePaths.has(pathKey(entry.path))
  const lastReadAt = !entry.isDirectory ? readingAtByPath.get(pathKey(entry.path)) : undefined

  const loadChildren = useCallback(async (): Promise<void> => {
    if (!entry.isDirectory) return
    try {
      const items = await window.api.fs.listDirectory(entry.path)
      setChildren(sortFileEntries(items, favoritePaths))
    } catch {
      setChildren([])
    }
  }, [entry.path, entry.isDirectory, favoritePaths])

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
      <div
        className={`file-tree-item ${activePath === entry.path ? 'active' : ''}${isOpen ? ' open-doc' : ''}`}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onContextMenu={(e) => onContextMenu(e, entry)}
      >
        {entry.isDirectory ? (
          <button
            type="button"
            className="tree-chevron-btn"
            aria-label={expanded ? '折叠文件夹' : '展开文件夹'}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="tree-chevron placeholder" />
        )}
        {entry.isDirectory ? (
          <span className="tree-favorite placeholder" aria-hidden />
        ) : (
          <button
            type="button"
            className={`tree-favorite${isFavorite ? ' is-favorite' : ''}`}
            title={isFavorite ? '取消收藏' : '收藏'}
            aria-label={isFavorite ? '取消收藏' : '收藏'}
            onClick={() => onToggleFavorite(entry.path)}
          >
            <Star size={12} strokeWidth={2} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}
        <button type="button" className="file-tree-item-main" title={entry.path} onClick={() => void handleClick()}>
          <span className="icon">
            <FileTypeIcon name={entry.name} isDirectory={entry.isDirectory} />
          </span>
          <span className="tree-name">{entry.name}</span>
          {lastReadAt && <TreeReadTimeBadge iso={lastReadAt} />}
        </button>
      </div>
      {expanded &&
        children.map((child) => (
          <FileTreeItem
            key={child.path}
            entry={child}
            depth={depth + 1}
            activePath={activePath}
            onContextMenu={onContextMenu}
            refreshKey={refreshKey}
            favoritePaths={favoritePaths}
            readingAtByPath={readingAtByPath}
            onToggleFavorite={onToggleFavorite}
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
    clearRootFolder,
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
  const [localLibraryPath, setLocalLibraryPath] = useState<string | null>(null)
  const [isLocalLibrary, setIsLocalLibrary] = useState(false)
  const [rootExpanded, setRootExpanded] = useState(true)
  const [appEnv, setAppEnv] = useState<AppEnvironmentInfo | null>(null)
  const [libraryReady, setLibraryReady] = useState(false)
  const [favoritePaths, setFavoritePaths] = useState<Set<string>>(() => new Set())
  const [favoriteList, setFavoriteList] = useState<string[]>([])
  const [readingAtByPath, setReadingAtByPath] = useState<Map<string, string>>(() => new Map())
  const libraryInitRef = useRef(false)
  const explorerRootBeforeLibrary = useRef<string | null>(null)

  const activePath = documents.find((d) => d.id === activeDocumentId)?.path
  const folderName = isLocalLibrary
    ? appEnv?.profile === 'test'
      ? '测试资料库'
      : '我的资料库'
    : rootFolder
      ? rootFolder.split(/[/\\]/).pop()
      : null

  const loadFileMeta = useCallback(async (): Promise<void> => {
    const [favorites, progressIndex] = await Promise.all([
      window.api.fileFavorites.list(),
      window.api.readingProgress.listIndex()
    ])
    setFavoriteList(favorites)
    setFavoritePaths(new Set(favorites.map(pathKey)))
    setReadingAtByPath(
      new Map(
        Object.entries(progressIndex).map(([filePath, entry]) => [pathKey(filePath), entry.updatedAt])
      )
    )
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    if (!rootFolder) {
      setEntries([])
      return
    }
    const items = await window.api.fs.listDirectory(rootFolder)
    setEntries(sortFileEntries(items, favoritePaths))
    setRefreshKey((k) => k + 1)
  }, [rootFolder, favoritePaths])

  const handleToggleFavorite = useCallback(
    (filePath: string): void => {
      void (async () => {
        try {
          setError(null)
          await window.api.fileFavorites.toggle(filePath)
          const favorites = await window.api.fileFavorites.list()
          const nextFavoritePaths = new Set(favorites.map(pathKey))
          setFavoriteList(favorites)
          setFavoritePaths(nextFavoritePaths)
          if (rootFolder) {
            const items = await window.api.fs.listDirectory(rootFolder)
            setEntries(sortFileEntries(items, nextFavoritePaths))
          }
          setRefreshKey((k) => k + 1)
        } catch (err) {
          setError(err instanceof Error ? err.message : '收藏操作失败')
        }
      })()
    },
    [rootFolder]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    void loadFileMeta()
  }, [loadFileMeta, activeDocumentId, refreshKey])

  useEffect(() => {
    void window.api.app.getEnvironment().then(setAppEnv)
  }, [])

  useEffect(() => {
    if (!rootFolder) {
      setIsLocalLibrary(false)
      return
    }
    let cancelled = false
    void window.api.localLibrary.isPath(rootFolder).then((value) => {
      if (!cancelled) setIsLocalLibrary(value)
    })
    return () => {
      cancelled = true
    }
  }, [rootFolder])

  useEffect(() => {
    if (libraryInitRef.current) return
    libraryInitRef.current = true
    void (async () => {
      const path = await window.api.localLibrary.getPath()
      setLocalLibraryPath(path)
      if (!useWorkspaceStore.getState().rootFolder) {
        const items = await window.api.fs.listDirectory(path)
        setRootFolder(path, items)
      }
      setLibraryReady(true)
    })()
  }, [setRootFolder])

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
    setError(null)
    try {
      const result = await window.api.dialog.openFolder()
      if (result) setRootFolder(result.path, result.files)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
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
      const result =
        isLocalLibrary
          ? await window.api.localLibrary.import()
          : await window.api.dialog.importFiles(targetDir)
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

  const handleUploadToLibrary = async (): Promise<void> => {
    if (!rootFolder) {
      setError('资料库尚未就绪，请稍后重试')
      return
    }
    await handleImportFiles(rootFolder)
  }

  const handleOpenLocalLibrary = async (): Promise<void> => {
    setError(null)
    const path = await window.api.localLibrary.getPath()
    setLocalLibraryPath(path)
    const current = useWorkspaceStore.getState().rootFolder
    if (current && !pathsEqual(current, path)) {
      explorerRootBeforeLibrary.current = current
    }
    const items = await window.api.fs.listDirectory(path)
    setRootFolder(path, items)
  }

  const handleCloseLocalLibrary = async (): Promise<void> => {
    setError(null)
    const previous = explorerRootBeforeLibrary.current
    explorerRootBeforeLibrary.current = null
    if (previous) {
      try {
        const items = await window.api.fs.listDirectory(previous)
        setRootFolder(previous, items)
        return
      } catch {
        // 之前的文件夹已不存在，继续退出资料库
      }
    }
    clearRootFolder()
    setEntries([])
  }

  const handleToggleLocalLibrary = (): void => {
    if (isLocalLibrary) {
      void handleCloseLocalLibrary()
    } else {
      void handleOpenLocalLibrary()
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
        const oldPath = prompt.entry.path
        const info = await window.api.fs.rename(oldPath, value)
        await window.api.fileFavorites.rename(oldPath, info.path)
        const doc = documents.find((d) => d.path === oldPath)
        if (doc) {
          closeDocument(doc.id)
          if (info.supported) openDocument(info)
        }
      }
      await refresh()
      await loadFileMeta()
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
      await window.api.fileFavorites.remove(confirmDelete.path)
      documents
        .filter((d) => {
          const base = confirmDelete.path
          const sep = base.includes('\\') ? '\\' : '/'
          return d.path === base || d.path.startsWith(base + sep)
        })
        .forEach((d) => closeDocument(d.id))
      await refresh()
      await loadFileMeta()
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
          <IconButton
            icon={Upload}
            label="上传文件"
            disabled={!rootFolder}
            onClick={() => void handleUploadToLibrary()}
          />
          <IconButton icon={RefreshCw} label="刷新" disabled={!rootFolder} onClick={() => void refresh()} />
          <IconButton
            icon={Library}
            label={isLocalLibrary ? '退出资料库' : '我的资料库'}
            className={isLocalLibrary ? 'sidebar-action-active' : undefined}
            onClick={() => void handleToggleLocalLibrary()}
          />
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
        {!rootFolder && !libraryReady && (
          <div className="explorer-hint">正在加载资料库…</div>
        )}
        {!rootFolder && libraryReady && (
          <div className="explorer-hint">
            未打开文件夹。可点击上方「我的资料库」或「打开文件夹」。
          </div>
        )}
        {rootFolder && (
          <div className="explorer-hint">
            {isLocalLibrary
              ? '我的资料库 · 可新建、上传、删除；点击「退出资料库」返回之前的文件夹或空白状态'
              : '外部文件夹 · 右键可导入、新建、删除；点击「我的资料库」切换至默认库'}
          </div>
        )}

        {folderName && (
          <button
            type="button"
            className="file-tree-item folder-root"
            style={{ paddingLeft: '12px' }}
            onClick={() => setRootExpanded((v) => !v)}
            title={rootFolder ?? undefined}
          >
            <span className="tree-chevron">
              {rootExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
            <span className="icon">
              <Folder size={14} />
            </span>
            <span className="tree-name">{folderName}</span>
          </button>
        )}

        {rootExpanded &&
          entries.map((entry) => (
            <FileTreeItem
              key={entry.path}
              entry={entry}
              depth={1}
              activePath={activePath}
              onContextMenu={handleContextMenu}
              refreshKey={refreshKey}
              favoritePaths={favoritePaths}
              readingAtByPath={readingAtByPath}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
      </div>

      {favoriteList.length > 0 && (
        <div className="recent-section favorites-section">
          <div className="sidebar-header">
            <span>收藏</span>
          </div>
          {favoriteList.map((path) => {
            const name = path.split(/[/\\]/).pop() ?? path
            const lastReadAt = readingAtByPath.get(pathKey(path))
            return (
              <PathTooltipItem
                key={path}
                path={path}
                className={`file-tree-item ${activePath === path ? 'active' : ''}`}
                onClick={async () => {
                  const info = await window.api.fs.getFileInfo(path)
                  if (info.supported) openDocument(info)
                }}
              >
                <span className="tree-chevron placeholder" />
                <span className="tree-favorite is-favorite" aria-hidden>
                  <Star size={12} strokeWidth={2} fill="currentColor" />
                </span>
                <span className="icon">
                  <FileTypeIcon name={name} />
                </span>
                <span className="tree-name">{name}</span>
                {lastReadAt && <TreeReadTimeBadge iso={lastReadAt} alwaysVisible />}
              </PathTooltipItem>
            )
          })}
        </div>
      )}

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
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleToggleFavorite(contextMenu.entry!.path)
                  setContextMenu(null)
                }}
              >
                {favoritePaths.has(pathKey(contextMenu.entry.path))
                  ? '取消收藏'
                  : '加入收藏'}
              </button>
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
