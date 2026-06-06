export type McpTransport = 'stdio' | 'http'

export interface McpServerConfig {
  id: string
  name: string
  enabled: boolean
  transport: McpTransport
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
}

export interface McpConfigFile {
  servers: McpServerConfig[]
}

export type McpServerStatus = 'disabled' | 'stopped' | 'starting' | 'running' | 'error'

export interface McpServerState {
  id: string
  name: string
  enabled: boolean
  status: McpServerStatus
  toolCount: number
  lastError?: string
}

export interface McpToolDescriptor {
  serverId: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
}
