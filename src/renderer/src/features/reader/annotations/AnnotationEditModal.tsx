import { useState } from 'react'
import type { Annotation } from '../../../types/global.d'

const COLORS = ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']

interface AnnotationEditModalProps {
  item: Annotation
  onSave: (patch: Partial<Annotation>) => void
  onCancel: () => void
}

export function AnnotationEditModal({
  item,
  onSave,
  onCancel
}: AnnotationEditModalProps): JSX.Element {
  const [content, setContent] = useState(item.content ?? '')
  const [color, setColor] = useState(item.color)

  const canEditContent = item.type === 'note' || Boolean(item.content)
  const canEditColor =
    item.type === 'highlight' ||
    item.type === 'underline' ||
    item.type === 'pen' ||
    item.type === 'rect' ||
    item.type === 'note'

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card annotation-edit-modal" onClick={(e) => e.stopPropagation()}>
        <h3>编辑标注</h3>
        {canEditContent && (
          <label>
            便签内容
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              autoFocus
            />
          </label>
        )}
        {canEditColor && (
          <div className="annotation-edit-colors">
            <span className="annotation-edit-colors-label">颜色</span>
            <div className="annotation-toolbar-colors">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`annotation-color-swatch${color === c ? ' active' : ''}`}
                  style={{ backgroundColor: c }}
                  aria-label={`颜色 ${c}`}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        )}
        <div className="modal-actions">
          <button className="secondary-btn" onClick={onCancel}>
            取消
          </button>
          <button
            className="primary-btn"
            onClick={() => {
              const patch: Partial<Annotation> = {}
              if (canEditContent) patch.content = content.trim() || undefined
              if (canEditColor) patch.color = color
              onSave(patch)
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
