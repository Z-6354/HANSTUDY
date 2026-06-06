import { ChevronLeft, Files, Globe, StickyNote } from 'lucide-react'
import { IconButton } from '../../components/IconButton'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { FileExplorer } from './FileExplorer'
import { NotesPanel } from './NotesPanel'
import { WebPanel } from './WebPanel'

export function SideBar(): JSX.Element {
  const { sidebarTab, setSidebarTab, closeSidebar } = useWorkspaceStore()

  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        <IconButton
          icon={Files}
          label="文件"
          className={`sidebar-tab ${sidebarTab === 'explorer' ? 'active' : ''}`}
          active={sidebarTab === 'explorer'}
          onClick={() => setSidebarTab('explorer')}
        />
        <IconButton
          icon={StickyNote}
          label="标注"
          className={`sidebar-tab ${sidebarTab === 'notes' ? 'active' : ''}`}
          active={sidebarTab === 'notes'}
          onClick={() => setSidebarTab('notes')}
        />
        <IconButton
          icon={Globe}
          label="网页"
          className={`sidebar-tab ${sidebarTab === 'web' ? 'active' : ''}`}
          active={sidebarTab === 'web'}
          onClick={() => setSidebarTab('web')}
        />
        <IconButton
          icon={ChevronLeft}
          label="收起侧栏"
          size={14}
          className="sidebar-collapse-btn"
          onClick={closeSidebar}
        />
      </div>

      {sidebarTab === 'notes' ? (
        <NotesPanel />
      ) : sidebarTab === 'web' ? (
        <WebPanel />
      ) : (
        <FileExplorer />
      )}
    </div>
  )
}
