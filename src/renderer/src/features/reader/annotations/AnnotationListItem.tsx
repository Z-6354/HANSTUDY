import type { MouseEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { IconButton } from '../../../components/IconButton'
import type { Annotation } from '../../../types/global.d'
import { formatAnnotationTime, typeLabel } from './annotationListUtils'

interface AnnotationListItemProps {
  item: Annotation
  focused?: boolean
  showTime?: boolean
  onFocus: () => void
  onEdit: () => void
  onDelete: () => void
}

export function AnnotationListItem({
  item,
  focused = false,
  showTime = false,
  onFocus,
  onEdit,
  onDelete
}: AnnotationListItemProps): JSX.Element {
  return (
    <div
      className={`note-item${focused ? ' note-item-focused' : ''}`}
      onClick={onFocus}
    >
      <div className="note-item-header">
        <span className="note-type">{typeLabel(item.type)}</span>
        <div className="note-item-actions">
          {showTime && item.createdAt && (
            <span className="note-time">{formatAnnotationTime(item.createdAt)}</span>
          )}
          <IconButton
            icon={Pencil}
            label="编辑标注"
            size={14}
            className="note-edit"
            onClick={(e: MouseEvent) => {
              e.stopPropagation()
              onEdit()
            }}
          />
          <IconButton
            icon={Trash2}
            label="删除标注"
            size={14}
            className="note-delete"
            onClick={(e: MouseEvent) => {
              e.stopPropagation()
              onDelete()
            }}
          />
        </div>
      </div>
      {item.selectedText && (
        <div className="note-quote">{item.selectedText.slice(0, 120)}</div>
      )}
      {item.content && <div className="note-content">{item.content}</div>}
      {item.shape?.points?.length ? (
        <div className="note-meta">手绘 · {item.shape.points.length} 点</div>
      ) : null}
      {item.shape?.width != null && item.shape?.height != null ? (
        <div className="note-meta">方框标注</div>
      ) : null}
      {item.pdfAnchor && <div className="note-meta">PDF 第 {item.pdfAnchor.page} 页</div>}
    </div>
  )
}
