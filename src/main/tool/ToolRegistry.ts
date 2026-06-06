import type { OpenAiToolSchema, ToolInvocation, ToolOutput } from '../../shared/agent/tools'
import { AuditLog } from '../policy/AuditLog'
import { PathGuard } from '../policy/PathGuard'

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolOutput>

export interface RegisteredTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  handler: ToolHandler
}

export class ToolRegistry {
  readonly pathGuard = new PathGuard()
  private readonly tools = new Map<string, RegisteredTool>()
  private readonly audit = new AuditLog()
  private mcpHandlers = new Map<string, ToolHandler>()

  register(tool: RegisteredTool): void {
    this.tools.set(tool.name, tool)
  }

  registerMcpTool(name: string, description: string, parameters: Record<string, unknown>, handler: ToolHandler): void {
    this.mcpHandlers.set(name, handler)
    this.tools.set(name, { name, description, parameters, handler })
  }

  unregisterMcpTools(prefix: string): void {
    for (const name of Array.from(this.tools.keys())) {
      if (name.startsWith(prefix)) {
        this.tools.delete(name)
        this.mcpHandlers.delete(name)
      }
    }
  }

  getOpenAiSchemas(): OpenAiToolSchema[] {
    return Array.from(this.tools.values()).map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }))
  }

  async executeTool(inv: ToolInvocation): Promise<ToolOutput> {
    const tool = this.tools.get(inv.name)
    if (!tool) {
      return { success: false, content: '', error: `未知工具: ${inv.name}` }
    }
    try {
      const result = await tool.handler(inv.arguments ?? {})
      await this.audit.record({
        tool: inv.name,
        success: result.success,
        detail: result.error
      })
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await this.audit.record({ tool: inv.name, success: false, detail: message })
      return { success: false, content: '', error: message }
    }
  }

  async executeTools(invs: ToolInvocation[], maxParallel = 4): Promise<ToolOutput[]> {
    const results: ToolOutput[] = new Array(invs.length)
    let index = 0
    const workers = Array.from({ length: Math.min(maxParallel, invs.length) }, async () => {
      while (index < invs.length) {
        const i = index++
        results[i] = await this.executeTool(invs[i])
      }
    })
    await Promise.all(workers)
    return results
  }
}
