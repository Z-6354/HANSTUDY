import { useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, Pencil } from 'lucide-react'
import { IconButton } from '../../components/IconButton'
import { AnnotationListItem } from '../../features/reader/annotations/AnnotationListItem'
import { AnnotationEditModal } from '../../features/reader/annotations/AnnotationEditModal'
import {
  getRecentAnnotations,
  groupAnnotationsByType
} from '../../features/reader/annotations/annotationListUtils'
import { useAnnotations } from '../../features/reader/annotations/useAnnotations'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import type { Annotation, WebSnapshotMeta } from '../../types/global.d'

export function NotesPanel(): JSX.Element {
  const { documents, activeDocumentId, focusAnnotationId, setFocusAnnotationId, setSidebarTab } =
    useWorkspaceStore()
  const activeDoc = documents.find((d) => d.id === activeDocumentId)
  const isReadableDoc =
    activeDoc &&
    activeDoc.type !== 'settings' &&
    activeDoc.type !== 'unknown' &&
    activeDoc.type !== 'web'
  const docPath = isReadableDoc ? activeDoc.path : ''
  const { annotations, loading, error, remove, update } = useAnnotations(docPath || '__none__')
  const [exporting, setExporting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<Annotation | null>(null)
  const [storageMode, setStorageMode] = useState<'java' | 'node'>('node')
  const [snapshotMeta, setSnapshotMeta] = useState<WebSnapshotMeta | null>(null)

  const recentItems = useMemo(() => getRecentAnnotations(annotations), [annotations])
  const categoryGroups = useMemo(() => groupAnnotationsByType(annotations), [annotations])

  useEffect(() => {
    if (activeDoc?.type === 'web-snapshot') {
      void window.api.web.getSnapshotMeta(activeDoc.path).then(setSnapshotMeta)
    } else {
      setSnapshotMeta(null)
    }
  }, [activeDoc?.path, activeDoc?.type])

  useEffect(() => {
    void window.api.backend.getStatus().then((s) => setStorageMode(s.storageMode))
  }, [annotations.length])

  const handleExport = async (): Promise<void> => {
    if (!docPath) return
    setExporting(true)
    setActionError(null)
    try {
      const md = await window.api.annotations.exportMarkdown(docPath)
      const name = activeDoc?.name.replace(/\.[^.]+$/, '') + '-annotations.md'
      const saved = await window.api.dialog.saveMarkdown(md, name)
      if (!saved) return
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  const focusItem = (id: string): void => {
    setFocusAnnotationId(id)
    setSidebarTab('notes')
  }

  const deleteItem = (id: string): void => {
    setActionError(null)
    void remove(id).catch((err) => {
      setActionError(err instanceof Error ? err.message : '删除失败')
    })
  }

  if (!activeDoc) {
    return (
      <div className="notes-panel-empty">
        <p>打开文档后在此查看标注与便签</p>
      </div>
    )
  }

  if (!isReadableDoc) {
    return (
      <div className="notes-panel-empty">
        <p>
          {activeDoc?.type === 'web'
            ? '在线网页不支持标注，请先点击「保存网页」'
            : '当前标签页不支持标注'}
        </p>
      </div>
    )
  }

  return (
    <div className="notes-panel">
      {snapshotMeta && (
        <div className="notes-snapshot-source">
          <span className="notes-snapshot-label">网页快照</span>
          <button
            type="button"
            className="notes-snapshot-link"
            title={snapshotMeta.sourceUrl}
            onClick={() => void window.api.web.openExternal(snapshotMeta.sourceUrl)}
          >
            <ExternalLink size={12} aria-hidden />
            {snapshotMeta.sourceUrl}
          </button>
        </div>
      )}
      <div className="sidebar-header">
        <span>
          标注 ({annotations.length})
          <span className="notes-storage-badge">
            {storageMode === 'java' ? 'Java' : '本地'}
          </span>
        </span>
        <IconButton
          icon={Download}
          label="导出 Markdown"
          disabled={exporting || annotations.length === 0}
          onClick={() => void handleExport()}
        />
      </div>
      {(error || actionError) && <div className="notes-error">{error ?? actionError}</div>}
      <div className="notes-list">
        {loading && <div className="notes-empty">加载中...</div>}
        {!loading && annotations.length === 0 && (
          <div className="notes-empty">选中文本后点击高亮或便签</div>
        )}
        {!loading && recentItems.length > 0 && (
          <section className="notes-section notes-section-recent">
            <h3 className="notes-section-title">最近</h3>
            {recentItems.map((item) => (
              <AnnotationListItem
                key={`recent-${item.id}`}
                item={item}
                focused={focusAnnotationId === item.id}
                showTime
                onFocus={() => focusItem(item.id)}
                onEdit={() => setEditItem(item)}
                onDelete={() => deleteItem(item.id)}
              />
            ))}
          </section>
        )}
        {!loading &&
          categoryGroups.map((group) => (
            <section key={group.type} className="notes-section">
              <h3 className="notes-section-title">
                {group.label}
                <span className="notes-section-count">{group.items.length}</span>
              </h3>
              {group.items.map((item) => (
                <AnnotationListItem
                  key={item.id}
                  item={item}
                  focused={focusAnnotationId === item.id}
                  onFocus={() => focusItem(item.id)}
                  onEdit={() => setEditItem(item)}
                  onDelete={() => deleteItem(item.id)}
                />
              ))}
            </section>
          ))}
      </div>
      {editItem && (
        <AnnotationEditModal
          item={editItem}
          onCancel={() => setEditItem(null)}
          onSave={(patch) => {
            setActionError(null)
            void update(editItem.id, patch)
              .then(() => setEditItem(null))
              .catch((err) => {
                setActionError(err instanceof Error ? err.message : '保存失败')
              })
          }}
        />
      )}
    </div>
  )
}
