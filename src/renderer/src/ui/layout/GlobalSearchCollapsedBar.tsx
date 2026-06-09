import { ChevronDown, Search } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'

/** 顶部栏（搜索 + 模式）收起后的展开入口 */
export function GlobalSearchCollapsedBar(): JSX.Element {
  const toggleLayoutPanel = useWorkspaceStore((s) => s.toggleLayoutPanel)

  return (
    <div className="global-search-collapsed-bar">
      <button
        type="button"
        className="global-search-expand-btn"
        title="展开搜索 / 模式栏"
        aria-label="展开搜索 / 模式栏"
        onClick={() => toggleLayoutPanel('globalSearchBar')}
      >
        <Search size={14} aria-hidden />
        <span>搜索 / 模式</span>
        <ChevronDown size={12} aria-hidden />
      </button>
    </div>
  )
}
