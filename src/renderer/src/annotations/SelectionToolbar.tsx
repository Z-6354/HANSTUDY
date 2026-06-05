import { useState } from 'react'
import {
  Highlighter,
  Sparkles,
  StickyNote,
  Underline,
  X
} from 'lucide-react'
import { IconButton } from '../components/IconButton'
import { useWorkspaceStore } from '../stores/workspaceStore'

interface SelectionToolbarProps {
  rect: DOMRect
  onHighlight: () => void
  onUnderline: () => void
  onNote: () => void
  onAskAI: () => void
  onClose: () => void
}

export function SelectionToolbar({
  rect,
  onHighlight,
  onUnderline,
  onNote,
  onAskAI,
  onClose
}: SelectionToolbarProps): JSX.Element {
  const top = Math.max(8, rect.top - 44)
  const left = Math.min(window.innerWidth - 320, Math.max(8, rect.left))

  return (
    <div className="selection-toolbar" style={{ top, left }}>
      <IconButton icon={Highlighter} label="高亮" onClick={onHighlight} />
      <IconButton icon={Underline} label="下划线" onClick={onUnderline} />
      <IconButton icon={StickyNote} label="便签" onClick={onNote} />
      <IconButton icon={Sparkles} label="Ask AI" className="ai-btn" onClick={onAskAI} />
      <IconButton icon={X} label="关闭" className="close-btn" onClick={onClose} />
    </div>
  )
}

interface NoteInputModalProps {
  initialText?: string
  onSubmit: (content: string) => void
  onCancel: () => void
}

export function NoteInputModal({
  initialText = '',
  onSubmit,
  onCancel
}: NoteInputModalProps): JSX.Element {
  const [value, setValue] = useState(initialText)

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>添加便签</h3>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="输入笔记内容..."
          autoFocus
        />
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="primary-btn" onClick={() => onSubmit(value)}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

export function AskAIHint(): JSX.Element | null {
  const selection = useWorkspaceStore((s) => s.selection)
  if (!selection?.text) return null
  return <div className="ai-selection-hint">已选中 {selection.text.length} 字</div>
}
