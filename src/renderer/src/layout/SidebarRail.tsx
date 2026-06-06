import { Files, Globe, StickyNote } from 'lucide-react'
import { IconButton } from '../components/IconButton'
import { useWorkspaceStore } from '../stores/workspaceStore'

/** 侧栏收起后左侧悬浮条，点击展开对应面板 */
export function SidebarRail(): JSX.Element {
  const { sidebarTab, openSidebar } = useWorkspaceStore()

  return (
    <div className="sidebar-rail" role="toolbar" aria-label="侧栏快捷入口">
      <IconButton
        icon={Files}
        label="打开文件夹"
        size={18}
        className={`sidebar-rail-btn ${sidebarTab === 'explorer' ? 'active' : ''}`}
        active={sidebarTab === 'explorer'}
        onClick={() => openSidebar('explorer')}
      />
      <IconButton
        icon={StickyNote}
        label="打开标注"
        size={18}
        className={`sidebar-rail-btn ${sidebarTab === 'notes' ? 'active' : ''}`}
        active={sidebarTab === 'notes'}
        onClick={() => openSidebar('notes')}
      />
      <IconButton
        icon={Globe}
        label="打开网页"
        size={18}
        className={`sidebar-rail-btn ${sidebarTab === 'web' ? 'active' : ''}`}
        active={sidebarTab === 'web'}
        onClick={() => openSidebar('web')}
      />
    </div>
  )
}
