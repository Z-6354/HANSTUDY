import { SIDEBAR_PANELS } from '../../features/sidebar/sidebarRegistry'
import { useDraggableFloat } from '../../hooks/useDraggableFloat'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { IconButton } from '../../components/IconButton'

/** 侧栏收起后左侧悬浮条：拖动 reposition，点击图标展开对应面板 */
export function SidebarRail(): JSX.Element {
  const { sidebarTab, openSidebar } = useWorkspaceStore()
  const { containerRef, style, dragHandlers, shouldSuppressClick } = useDraggableFloat(
    'sidebar',
    'left'
  )

  return (
    <div
      ref={containerRef}
      className="sidebar-rail layout-float-rail"
      style={style}
      role="toolbar"
      aria-label="侧栏快捷入口"
      {...dragHandlers}
    >
      {SIDEBAR_PANELS.map((panel) => (
        <IconButton
          key={panel.id}
          icon={panel.icon}
          label={`打开${panel.label}`}
          size={18}
          className={`sidebar-rail-btn ${sidebarTab === panel.id ? 'active' : ''}`}
          active={sidebarTab === panel.id}
          onClick={() => {
            if (shouldSuppressClick()) return
            openSidebar(panel.id)
          }}
        />
      ))}
    </div>
  )
}
