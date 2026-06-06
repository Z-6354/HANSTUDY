import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { AIRail } from './AIRail'
import { AIPanel } from '../../features/ai/AIPanel'
import { EditorArea } from './EditorArea'
import { SideBar } from './SideBar'
import { SidebarRail } from './SidebarRail'

export function Workbench(): JSX.Element {
  const showAIPanel = useWorkspaceStore((s) => s.showAIPanel)
  const showSidebar = useWorkspaceStore((s) => s.showSidebar)
  const focusMode = useWorkspaceStore((s) => s.focusMode)
  const viewerStatus = useWorkspaceStore((s) => s.viewerStatus)
  const setViewerStatus = useWorkspaceStore((s) => s.setViewerStatus)

  return (
    <div className="workbench">
      {viewerStatus?.detail && (
        <div className="viewer-status-banner" role="status">
          <span>{viewerStatus.detail}</span>
          <button type="button" className="viewer-status-dismiss" onClick={() => setViewerStatus(null)}>
            关闭
          </button>
        </div>
      )}
      <Allotment key={focusMode ? 'focus' : 'normal'}>
        {showSidebar && (
          <Allotment.Pane preferredSize={260} minSize={180} maxSize={400}>
            <SideBar />
          </Allotment.Pane>
        )}
        <Allotment.Pane>
          <EditorArea />
        </Allotment.Pane>
        <Allotment.Pane visible={showAIPanel} preferredSize={320} minSize={240} maxSize={500}>
          <AIPanel />
        </Allotment.Pane>
      </Allotment>
      <div className="layout-rails-layer" aria-hidden={false}>
        {!showSidebar && <SidebarRail />}
        {!showAIPanel && <AIRail />}
      </div>
    </div>
  )
}
