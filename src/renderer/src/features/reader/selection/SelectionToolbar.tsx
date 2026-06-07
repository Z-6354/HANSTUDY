import { Sparkles, X } from 'lucide-react'
import { IconButton } from '../../../components/IconButton'
import { useWorkspaceStore } from '../../../stores/workspaceStore'

interface SelectionToolbarProps {
  rect: DOMRect
  onAskAI: () => void
  onClose: () => void
}

export function SelectionToolbar({ rect, onAskAI, onClose }: SelectionToolbarProps): JSX.Element {
  const top = Math.max(8, rect.top - 44)
  const left = Math.min(window.innerWidth - 200, Math.max(8, rect.left))

  return (
    <div className="selection-toolbar" style={{ top, left }}>
      <IconButton icon={Sparkles} label="Ask AI" className="ai-btn" onClick={onAskAI} />
      <IconButton icon={X} label="关闭" className="close-btn" onClick={onClose} />
    </div>
  )
}

export function AskAIHint(): JSX.Element | null {
  const selection = useWorkspaceStore((s) => s.selection)
  if (!selection?.text) return null
  return <div className="ai-selection-hint">已选中 {selection.text.length} 字</div>
}
