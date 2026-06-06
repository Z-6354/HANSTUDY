/** Agent 内置工具名称与类型 */

export const BUILTIN_TOOLS = {
  readDocument: 'read_document',
  getDocumentContext: 'get_document_context',
  listAnnotations: 'list_annotations',
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
