import { ChevronLeft } from 'lucide-react'
import { IconButton } from '../../components/IconButton'
import { SIDEBAR_PANELS } from '../../features/sidebar/sidebarRegistry'
import { useWorkspaceStore } from '../../stores/workspaceStore'

export function SideBar(): JSX.Element {
  const { sidebarTab, setSidebarTab, closeSidebar } = useWorkspaceStore()
  const activePanel = SIDEBAR_PANELS.find((p) => p.id === sidebarTab) ?? SIDEBAR_PANELS[0]
  const PanelComponent = activePanel.component

  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        {SIDEBAR_PANELS.map((panel) => (
          <IconButton
            key={panel.id}
            icon={panel.icon}
            label={panel.label}
            className={`sidebar-tab ${sidebarTab === panel.id ? 'active' : ''}`}
            active={sidebarTab === panel.id}
            onClick={() => setSidebarTab(panel.id)}
          />
        ))}
        <IconButton
          icon={ChevronLeft}
          label="收起侧栏"
          size={14}
          className="sidebar-collapse-btn"
          onClick={closeSidebar}
        />
      </div>
      <PanelComponent />
    </div>
  )
}
