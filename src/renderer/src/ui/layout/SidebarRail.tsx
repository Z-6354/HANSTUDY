import { SIDEBAR_PANELS } from '../../features/sidebar/sidebarRegistry'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { IconButton } from '../../components/IconButton'

/** 侧栏收起后左侧悬浮条，点击展开对应面板 */
export function SidebarRail(): JSX.Element {
  const { sidebarTab, openSidebar } = useWorkspaceStore()

  return (
    <div className="sidebar-rail" role="toolbar" aria-label="侧栏快捷入口">
      {SIDEBAR_PANELS.map((panel) => (
        <IconButton
          key={panel.id}
          icon={panel.icon}
          label={`打开${panel.label}`}
          size={18}
          className={`sidebar-rail-btn ${sidebarTab === panel.id ? 'active' : ''}`}
          active={sidebarTab === panel.id}
          onClick={() => openSidebar(panel.id)}
        />
      ))}
    </div>
  )
}
