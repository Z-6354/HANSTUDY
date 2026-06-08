import { Sparkles } from 'lucide-react'
import { IconButton } from '../../components/IconButton'
import { useDraggableFloat } from '../../hooks/useDraggableFloat'
import { useWorkspaceStore } from '../../stores/workspaceStore'

/** AI 面板收起后右侧悬浮条：拖动 reposition，点击打开 AI 助手 */
export function AIRail(): JSX.Element {
  const openAIPanel = useWorkspaceStore((s) => s.openAIPanel)
  const { containerRef, style, dragHandlers, shouldSuppressClick } = useDraggableFloat('ai', 'right')

  const handleOpen = (): void => {
    if (shouldSuppressClick()) return
    openAIPanel()
  }

  return (
    <div
      ref={containerRef}
      className="ai-rail layout-float-rail"
      style={style}
      role="toolbar"
      aria-label="AI 助手快捷入口"
      {...dragHandlers}
    >
      <IconButton
        icon={Sparkles}
        label="打开 AI 助手"
        size={18}
        className="ai-rail-btn"
        onClick={handleOpen}
      />
    </div>
  )
}
