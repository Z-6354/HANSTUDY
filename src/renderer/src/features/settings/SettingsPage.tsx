import type { LucideIcon } from 'lucide-react'
import { FolderRoot, Plug, Puzzle, ScrollText, Settings } from 'lucide-react'
import { Icon } from '../../components/IconButton'
import { useWorkspaceStore, type SettingsSection } from '../../stores/workspaceStore'
import { LogsPanel } from './LogsPanel'
import { McpPanel } from './McpPanel'
import { ProjectConfigPanel } from './ProjectConfigPanel'
import { SkillPanel } from './SkillPanel'
import { SystemConfigPanel } from './SystemConfigPanel'

interface NavItem {
  id: SettingsSection
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { id: 'system', label: '系统配置', icon: Settings },
  { id: 'project', label: '项目', icon: FolderRoot },
  { id: 'skill', label: 'Skill', icon: Puzzle },
  { id: 'mcp', label: 'MCP', icon: Plug },
  { id: 'logs', label: '日志', icon: ScrollText }
]

export function SettingsPage(): JSX.Element {
  const { settingsSection, setSettingsSection } = useWorkspaceStore()

  return (
    <div className="settings-page">
      <nav className="settings-nav">
        <div className="settings-nav-header">软件设置</div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`settings-nav-item ${settingsSection === item.id ? 'active' : ''}`}
            onClick={() => setSettingsSection(item.id)}
          >
            <span className="settings-nav-icon">
              <Icon icon={item.icon} size={16} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="settings-content">
        {settingsSection === 'system' && <SystemConfigPanel />}
        {settingsSection === 'project' && <ProjectConfigPanel />}
        {settingsSection === 'skill' && <SkillPanel />}
        {settingsSection === 'mcp' && <McpPanel />}
        {settingsSection === 'logs' && <LogsPanel />}
      </div>
    </div>
  )
}
