import { useEffect, useState } from 'react'
import { Download, ExternalLink, Trash2 } from 'lucide-react'
import { IconButton } from '../components/IconButton'
import { useAnnotations } from '../annotations/useAnnotations'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { WebSnapshotMeta } from '../types/global.d'

function typeLabel(type: string): string {
  if (type === 'highlight') return '高亮'
  if (type === 'underline') return '下划线'
  if (type === 'pen') return '画笔'
  if (type === 'rect') return '方框'
  return '便签'
}

export function NotesPanel(): JSX.Element {
  const { documents, activeDocumentId, setFocusAnnotationId, setSidebarTab } = useWorkspaceStore()
  const activeDoc = documents.find((d) => d.id === activeDocumentId)
  const isReadableDoc =
    activeDoc &&
    activeDoc.type !== 'settings' &&
    activeDoc.type !== 'unknown' &&
    activeDoc.type !== 'web'
  const docPath = isReadableDoc ? activeDoc.path : ''
  const { annotations, loading, error, remove } = useAnnotations(docPath || '__none__')
  const [exporting, setExporting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [storageMode, setStorageMode] = useState<'java' | 'node'>('node')
  const [snapshotMeta, setSnapshotMeta] = useState<WebSnapshotMeta | null>(null)

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
        <p>{activeDoc?.type === 'web' ? '在线网页不支持标注，请先点击「保存网页」' : '当前标签页不支持标注'}</p>
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
      {(error || actionError) && (
        <div className="notes-error">{error ?? actionError}</div>
      )}
      <div className="notes-list">
        {loading && <div className="notes-empty">加载中...</div>}
        {!loading && annotations.length === 0 && (
          <div className="notes-empty">选中文本后点击高亮或便签</div>
        )}
        {annotations.map((item) => (
          <div
            key={item.id}
            className="note-item"
            onClick={() => {
              setFocusAnnotationId(item.id)
              setSidebarTab('notes')
            }}
          >
            <div className="note-item-header">
              <span className="note-type">{typeLabel(item.type)}</span>
              <IconButton
                icon={Trash2}
                label="删除标注"
                size={14}
                className="note-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  setActionError(null)
                  void remove(item.id).catch((err) => {
                    setActionError(err instanceof Error ? err.message : '删除失败')
                  })
                }}
              />
            </div>
            {item.selectedText && (
              <div className="note-quote">{item.selectedText.slice(0, 120)}</div>
            )}
            {item.content && <div className="note-content">{item.content}</div>}
            {item.shape?.points?.length ? (
              <div className="note-meta">手绘标注 · {item.shape.points.length} 点</div>
            ) : null}
            {item.shape?.width != null && item.shape?.height != null ? (
              <div className="note-meta">方框标注</div>
            ) : null}
            {item.pdfAnchor && (
              <div className="note-meta">PDF 第 {item.pdfAnchor.page} 页</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
