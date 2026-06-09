import type { WebSearchEngine } from './webCrop'

export interface AppSettings {
  searchEngine: WebSearchEngine
  /** 打开网页标签时自动收起左侧栏 */
  webBrowseHideSidebar: boolean
  /** 打开网页标签时自动收起 AI 面板 */
  webBrowseHideAIPanel: boolean
  /** 自动批准 MCP 等需 HITL 的工具调用 */
  hitlAutoApprove: boolean
  /** HanStudy 项目根目录（.hanstudy 配置所在；其下 workspace/ 为 Agent 可读范围）。 */
  workspaceRoot: string | null
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  searchEngine: 'bing',
  webBrowseHideSidebar: true,
  webBrowseHideAIPanel: true,
  hitlAutoApprove: false,
  workspaceRoot: null
}

export const WEB_SEARCH_ENGINE_OPTIONS: { id: WebSearchEngine; label: string }[] = [
  { id: 'bing', label: '必应 (Bing)' },
  { id: 'baidu', label: '百度' },
  { id: 'google', label: 'Google' }
]

export function searchEngineLabel(id: WebSearchEngine): string {
  return WEB_SEARCH_ENGINE_OPTIONS.find((o) => o.id === id)?.label ?? id
}
