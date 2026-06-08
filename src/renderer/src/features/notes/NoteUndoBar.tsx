import { RotateCcw, X } from 'lucide-react'

interface NoteUndoBarProps {
  count: number
  onUndo: () => void
  onDismiss: () => void
}

export function NoteUndoBar({ count, onUndo, onDismiss }: NoteUndoBarProps): JSX.Element {
  return (
    <div className="doc-note-undo-bar" role="status">
      <span className="doc-note-undo-text">
        {count === 1 ? '已删除笔记' : `已删除 ${count} 条笔记`}
      </span>
      <button type="button" className="doc-note-undo-btn" onClick={onUndo}>
        <RotateCcw size={14} />
        撤销
      </button>
      <button type="button" className="doc-note-undo-dismiss" aria-label="关闭" onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
  )
}
