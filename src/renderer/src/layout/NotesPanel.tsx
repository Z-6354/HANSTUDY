import { useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { IconButton } from '../components/IconButton'
import { useAnnotations } from '../annotations/useAnnotations'
import { useWorkspaceStore } from '../stores/workspaceStore'

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
  const docPath = activeDoc?.path ?? ''
  const { annotations, loading, remove } = useAnnotations(docPath || '__none__')
  const [exporting, setExporting] = useState(false)

  const handleExport = async (): Promise<void> => {
    if (!docPath) return
    setExporting(true)
    try {
      const md = await window.api.annotations.exportMarkdown(docPath)
      const name = activeDoc?.name.replace(/\.[^.]+$/, '') + '-annotations.md'
      await window.api.dialog.saveMarkdown(md, name)
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

  return (
    <div className="notes-panel">
      <div className="sidebar-header">
        <span>标注 ({annotations.length})</span>
        <IconButton
          icon={Download}
          label="导出 Markdown"
          disabled={exporting || annotations.length === 0}
          onClick={() => void handleExport()}
        />
      </div>
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
                  void remove(item.id)
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
