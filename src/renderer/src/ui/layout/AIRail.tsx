import { Sparkles } from 'lucide-react'
import { IconButton } from '../../components/IconButton'
import { useWorkspaceStore } from '../../stores/workspaceStore'

/** AI 面板收起后右侧悬浮条，点击展开 */
export function AIRail(): JSX.Element {
  const openAIPanel = useWorkspaceStore((s) => s.openAIPanel)

  return (
    <div className="ai-rail" role="toolbar" aria-label="AI 助手快捷入口">
      <IconButton
        icon={Sparkles}
        label="打开 AI 助手"
        size={18}
        className="ai-rail-btn"
        onClick={() => openAIPanel()}
      />
    </div>
  )
}
