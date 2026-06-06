import { useEffect, useState } from 'react'
import { Globe, Trash2 } from 'lucide-react'
import { IconButton } from '../../components/IconButton'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import type { WebSnapshotMeta } from '../../types/global.d'

export function WebSnapshotsSection(): JSX.Element {
  const { openWebSnapshot, webSnapshotTick, documents, activeDocumentId } = useWorkspaceStore()
  const [snapshots, setSnapshots] = useState<WebSnapshotMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const activePath = documents.find((d) => d.id === activeDocumentId)?.path

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void window.api.web
      .listSnapshots()
      .then((list) => {
        if (!cancelled) setSnapshots(list)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载快照失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [webSnapshotTick])

  if (loading && snapshots.length === 0) {
    return (
      <div className="web-snapshots-section">
        <div className="sidebar-header">
          <span>网页快照</span>
        </div>
        <div className="explorer-hint">加载中...</div>
      </div>
    )
  }

  if (!loading && snapshots.length === 0) {
    return (
      <div className="web-snapshots-section">
        <div className="sidebar-header">
          <span>网页快照</span>
        </div>
        <div className="explorer-hint">在网页标签中点击「保存网页」归档资料</div>
      </div>
    )
  }

  return (
    <div className="web-snapshots-section">
      <div className="sidebar-header">
        <span>网页快照 ({snapshots.length})</span>
      </div>
      {error && <div className="notes-error">{error}</div>}
      {snapshots.map((snap) => (
        <div
          key={snap.id}
          className={`web-snapshot-item ${activePath === snap.pdfPath ? 'active' : ''}`}
        >
          <button
            type="button"
            className="web-snapshot-main"
            title={`${snap.title}\n${snap.sourceUrl}`}
            onClick={() => openWebSnapshot(snap)}
          >
            <span className="icon">
              <Globe size={14} />
            </span>
            <span className="web-snapshot-text">
              <span className="tree-name">{snap.title}</span>
              <span className="web-snapshot-url">{snap.sourceUrl}</span>
            </span>
          </button>
          <IconButton
            icon={Trash2}
            label="删除快照"
            size={14}
            className="web-snapshot-delete"
            onClick={() => {
              setError(null)
              void window.api.web.deleteSnapshot(snap.id).then((ok) => {
                if (!ok) {
                  setError('删除失败')
                  return
                }
                useWorkspaceStore.getState().notifyWebSnapshotsChanged()
                const openDoc = documents.find((d) => d.path === snap.pdfPath)
                if (openDoc) useWorkspaceStore.getState().closeDocument(openDoc.id)
              })
            }}
          />
        </div>
      ))}
    </div>
  )
}
