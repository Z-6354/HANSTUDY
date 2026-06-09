/** Agent 内置工具名称与类型 */

export const BUILTIN_TOOLS = {
  readDocument: 'read_document',
  readDocumentRange: 'read_document_range',
  parsePdf: 'parse_pdf',
  getDocumentContext: 'get_document_context',
  listLibrary: 'list_library',
  globLibrary: 'glob_library',
  searchInLibrary: 'search_in_library',
  getReadingProgress: 'get_reading_progress',
  listNotes: 'list_notes',
  readNote: 'read_note',
  searchNotes: 'search_notes',
  loadSkill: 'load_skill',
  searchInDocument: 'search_in_document'
} as const

export type BuiltinToolName = (typeof BUILTIN_TOOLS)[keyof typeof BUILTIN_TOOLS]

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolInvocation {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolOutput {
  success: boolean
  content: string
  error?: string
}

export interface OpenAiToolSchema {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export function mcpToolName(server: string, tool: string): string {
  return `mcp__${server}__${tool}`
}

export function isMcpToolName(name: string): boolean {
  return name.startsWith('mcp__')
}

export function requiresHitlApproval(toolName: string): boolean {
  return isMcpToolName(toolName)
}

const BUILTIN_TOOL_LABELS: Record<string, string> = {
  [BUILTIN_TOOLS.readDocument]: '读取文档',
  [BUILTIN_TOOLS.readDocumentRange]: '按行读取',
  [BUILTIN_TOOLS.parsePdf]: '解析 PDF',
  [BUILTIN_TOOLS.getDocumentContext]: '文档摘要',
  [BUILTIN_TOOLS.searchInDocument]: '文档内搜索',
  [BUILTIN_TOOLS.listLibrary]: '浏览资料库',
  [BUILTIN_TOOLS.globLibrary]: '查找文件',
  [BUILTIN_TOOLS.searchInLibrary]: '资料库搜索',
  [BUILTIN_TOOLS.getReadingProgress]: '阅读进度',
  [BUILTIN_TOOLS.listNotes]: '笔记列表',
  [BUILTIN_TOOLS.readNote]: '读取笔记',
  [BUILTIN_TOOLS.searchNotes]: '搜索笔记',
  [BUILTIN_TOOLS.loadSkill]: '加载 Skill'
}

/** Agent 工具调用展示名（UI 进度条） */
export function formatToolDisplayName(name: string): string {
  if (BUILTIN_TOOL_LABELS[name]) return BUILTIN_TOOL_LABELS[name]
  if (isMcpToolName(name)) {
    const parts = name.split('__')
    const server = parts[1] ?? 'mcp'
    const tool = parts.slice(2).join('__') || 'tool'
    return `MCP · ${server}/${tool}`
  }
  return name
}
