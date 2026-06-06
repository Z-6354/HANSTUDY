import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { mcpToolName } from '../../shared/agent/tools'
import type { McpServerConfig, McpServerState, McpToolDescriptor } from '../../shared/mcp/types'
import type { ToolRegistry } from '../tool/ToolRegistry'
import { McpConfigLoader } from './McpConfigLoader'

interface RunningServer {
  config: McpServerConfig
  process: ChildProcessWithoutNullStreams
  client: McpStdioClient
  tools: McpToolDescriptor[]
  status: McpServerState['status']
  lastError?: string
}

export class McpServerManager {
  private readonly loader = new McpConfigLoader()
  private running = new Map<string, RunningServer>()
  private projectRoot: string | null = null

  setProjectRoot(root: string | null): void {
    this.projectRoot = root
  }

  async listStates(): Promise<McpServerState[]> {
    const config = await this.loader.load(this.projectRoot)
    return config.servers.map((s) => {
      const run = this.running.get(s.id)
      return {
        id: s.id,
        name: s.name,
        enabled: s.enabled,
        status: run?.status ?? (s.enabled ? 'stopped' : 'disabled'),
        toolCount: run?.tools.length ?? 0,
        lastError: run?.lastError
      }
    })
  }

  async startAll(registry: ToolRegistry): Promise<void> {
    await this.shutdown(registry)
    const config = await this.loader.load(this.projectRoot)
    for (const server of config.servers) {
      if (!server.enabled || server.transport !== 'stdio') continue
      await this.startServer(server, registry)
    }
  }

  async restart(serverId: string, registry: ToolRegistry): Promise<void> {
    const config = await this.loader.load(this.projectRoot)
    const server = config.servers.find((s) => s.id === serverId)
    if (!server) return
    await this.stopServer(serverId, registry)
    if (server.enabled) await this.startServer(server, registry)
  }

  async toggle(serverId: string, enabled: boolean, registry: ToolRegistry): Promise<void> {
    const user = await this.loader.load(null)
    const config = await this.loader.load(this.projectRoot)
    const base = config.servers.find((s) => s.id === serverId)
    if (!base) return
    const next = { ...base, enabled }
    const idx = user.servers.findIndex((s) => s.id === serverId)
    if (idx >= 0) user.servers[idx] = next
    else user.servers.push(next)
    await this.loader.saveUser(user)
    if (enabled) await this.startServer(next, registry)
    else await this.stopServer(serverId, registry)
  }

  async shutdown(registry?: ToolRegistry): Promise<void> {
    for (const id of Array.from(this.running.keys())) {
      await this.stopServer(id, registry)
    }
  }

  private async startServer(server: McpServerConfig, registry: ToolRegistry): Promise<void> {
    if (this.running.has(server.id)) {
      await this.stopServer(server.id, registry)
    }
    if (!server.command) {
      this.running.set(server.id, {
        config: server,
        process: null as unknown as ChildProcessWithoutNullStreams,
        client: null as unknown as McpStdioClient,
        tools: [],
        status: 'error',
        lastError: '缺少 command'
      })
      return
    }

    let child: ChildProcessWithoutNullStreams | null = null
    try {
      child = spawn(server.command, server.args ?? [], {
        env: { ...process.env, ...server.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32'
      })

      const client = new McpStdioClient(child)
      await client.initialize()
      const tools = await client.listTools(server.id)

      for (const tool of tools) {
        const toolName = mcpToolName(server.id, tool.name)
        registry.registerMcpTool(
          toolName,
          tool.description,
          tool.inputSchema,
          async (args) => {
            const run = this.running.get(server.id)
            if (!run || run.status !== 'running') {
              return { success: false, content: '', error: 'MCP 服务未运行' }
            }
            try {
              const content = await run.client.callTool(tool.name, args)
              return { success: true, content }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              return { success: false, content: '', error: message }
            }
          }
        )
      }

      this.running.set(server.id, {
        config: server,
        process: child,
        client,
        tools,
        status: 'running'
      })

      const prefix = `mcp__${server.id}__`
      const markDead = (lastError: string): void => {
        registry.unregisterMcpTools(prefix)
        const run = this.running.get(server.id)
        if (!run) return
        run.client.dispose(lastError)
        this.running.set(server.id, {
          ...run,
          status: 'error',
          lastError
        })
      }
      child.on('exit', (code) => {
        markDead(`MCP 进程已退出 (${code ?? 'unknown'})`)
      })
      child.on('error', (err) => {
        markDead(err.message)
      })
    } catch (err) {
      child?.kill()
      const message = err instanceof Error ? err.message : String(err)
      this.running.set(server.id, {
        config: server,
        process: null as unknown as ChildProcessWithoutNullStreams,
        client: null as unknown as McpStdioClient,
        tools: [],
        status: 'error',
        lastError: message
      })
    }
  }

  private async stopServer(serverId: string, registry?: ToolRegistry): Promise<void> {
    const run = this.running.get(serverId)
    if (run) {
      run.client?.dispose('MCP 服务已停止')
      if (run.process) {
        run.process.kill()
      }
    }
    registry?.unregisterMcpTools(`mcp__${serverId}__`)
    this.running.delete(serverId)
  }
}

class McpStdioClient {
  private nextId = 1
  private buffer = ''
  private disposed = false
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private timeouts = new Map<number, ReturnType<typeof setTimeout>>()

  constructor(private readonly proc: ChildProcessWithoutNullStreams) {
    proc.stdout.on('data', (chunk: Buffer) => this.onData(chunk.toString()))
    proc.stderr.on('data', (chunk: Buffer) => {
      console.warn('[mcp stderr]', chunk.toString())
    })
  }

  dispose(reason: string): void {
    if (this.disposed) return
    this.disposed = true
    for (const timer of Array.from(this.timeouts.values())) {
      clearTimeout(timer)
    }
    this.timeouts.clear()
    for (const p of Array.from(this.pending.values())) {
      p.reject(new Error(reason))
    }
    this.pending.clear()
    this.proc.stdout.removeAllListeners('data')
    this.proc.stderr.removeAllListeners('data')
  }

  private onData(text: string): void {
    this.buffer += text
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const msg = JSON.parse(trimmed) as { id?: number; result?: unknown; error?: { message?: string } }
        if (msg.id == null) continue
        const p = this.pending.get(msg.id)
        if (!p) continue
        this.clearRequest(msg.id)
        if (msg.error) p.reject(new Error(msg.error.message ?? 'MCP error'))
        else p.resolve(msg.result)
      } catch {
        // ignore non-json lines
      }
    }
  }

  private clearRequest(id: number): void {
    const timer = this.timeouts.get(id)
    if (timer) {
      clearTimeout(timer)
      this.timeouts.delete(id)
    }
    this.pending.delete(id)
  }

  private request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (this.disposed) {
      return Promise.reject(new Error('MCP 客户端已关闭'))
    }
    const id = this.nextId++
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params })
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.proc.stdin.write(payload + '\n')
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return
        this.clearRequest(id)
        reject(new Error(`MCP 请求超时: ${method}`))
      }, 15_000)
      this.timeouts.set(id, timer)
    })
  }

  async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'hanstudy-reader', version: '0.1.0' }
    })
    this.proc.stdin.write(
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n'
    )
  }

  async listTools(serverId: string): Promise<McpToolDescriptor[]> {
    const result = (await this.request('tools/list')) as {
      tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>
    }
    return (result.tools ?? []).map((t) => ({
      serverId,
      name: t.name,
      description: t.description ?? t.name,
      inputSchema: t.inputSchema ?? { type: 'object', properties: {} }
    }))
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = (await this.request('tools/call', { name, arguments: args })) as {
      content?: Array<{ type: string; text?: string }>
    }
    const parts = result.content?.map((c) => c.text ?? '').filter(Boolean) ?? []
    return parts.join('\n') || JSON.stringify(result)
  }
}
