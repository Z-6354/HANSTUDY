import { Files, StickyNote } from 'lucide-react'
import { IconButton } from '../components/IconButton'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { FileExplorer } from './FileExplorer'
import { NotesPanel } from './NotesPanel'

export function SideBar(): JSX.Element {
  const { sidebarTab, setSidebarTab } = useWorkspaceStore()

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
      </div>

      {sidebarTab === 'notes' ? <NotesPanel /> : <FileExplorer />}
    </div>
  )
}
