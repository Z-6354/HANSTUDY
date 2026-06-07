import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { Files, Globe, NotebookPen } from 'lucide-react'
import { FileExplorer } from '../../ui/layout/FileExplorer'
import { WebPanel } from '../../ui/layout/WebPanel'
import { NotesFolderPanel } from '../notes/NotesFolderPanel'
import type { SidebarTab } from '../../stores/workspaceStore'

export interface SidebarPanelDefinition {
  id: SidebarTab
  label: string
  icon: LucideIcon
  component: ComponentType
}

/** 侧栏面板注册表 — 开闭原则：新增面板只需在此注册，不改 SideBar 结构 */
export const SIDEBAR_PANELS: SidebarPanelDefinition[] = [
  { id: 'explorer', label: '文件', icon: Files, component: FileExplorer },
  { id: 'notes', label: '笔记', icon: NotebookPen, component: NotesFolderPanel },
  { id: 'web', label: '网页', icon: Globe, component: WebPanel }
]

export function getSidebarPanel(tab: SidebarTab): SidebarPanelDefinition {
  return SIDEBAR_PANELS.find((p) => p.id === tab) ?? SIDEBAR_PANELS[0]
}
