import { BookOpen, PenLine } from 'lucide-react'
import type { WorkbenchMode } from '../../types/global.d'
import { useWorkspaceStore } from '../../stores/workspaceStore'

const MODES: { id: WorkbenchMode; label: string; icon: typeof BookOpen }[] = [
  { id: 'browse', label: '浏览模式', icon: BookOpen },
  { id: 'compose', label: '笔记模式', icon: PenLine }
]

export function WorkbenchModeBar(): JSX.Element {
  const { workbenchMode, setWorkbenchMode } = useWorkspaceStore()

  return (
    <div className="workbench-mode-bar" role="tablist" aria-label="工作区模式">
      {MODES.map(({ id, label, icon: Icon }) => {
        const active = workbenchMode === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`workbench-mode-btn${active ? ' active' : ''}`}
            onClick={() => setWorkbenchMode(id)}
          >
            <Icon size={14} aria-hidden />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
