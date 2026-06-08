interface NoteDeleteConfirmModalProps {
  childCount: number
  onConfirm: () => void
  onCancel: () => void
}

export function NoteDeleteConfirmModal({
  childCount,
  onConfirm,
  onCancel
}: NoteDeleteConfirmModalProps): JSX.Element {
  const total = childCount + 1

  return (
    <div className="modal-overlay note-delete-overlay" onClick={onCancel}>
      <div
        className="modal-card note-delete-modal note-delete-modal--compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-delete-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="note-delete-title" className="note-delete-title">
          删除此笔记及 {childCount} 条子笔记？
        </h3>
        <p className="note-delete-hint">共 {total} 条，删除后可在数秒内撤销。</p>
        <div className="modal-actions note-delete-actions">
          <button type="button" className="secondary-btn" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="primary-btn danger-btn" onClick={onConfirm}>
            删除
          </button>
        </div>
      </div>
    </div>
  )
}
