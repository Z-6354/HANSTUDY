import { useWorkspaceStore } from '../../stores/workspaceStore'
import { GlobalSearchBar } from './GlobalSearchBar'
import { GlobalSearchCollapsedBar } from './GlobalSearchCollapsedBar'
import { WorkbenchModeBar } from './WorkbenchModeBar'

/** 顶部：搜索 / 网址栏 + 浏览·笔记·反馈模式切换，可一并收起 */
export function EditorTopChrome(): JSX.Element {
  const showGlobalSearchBar = useWorkspaceStore((s) => s.showGlobalSearchBar)

  if (!showGlobalSearchBar) {
    return <GlobalSearchCollapsedBar />
  }

  return (
    <div className="editor-top-chrome">
      <GlobalSearchBar />
      <WorkbenchModeBar />
    </div>
  )
}
