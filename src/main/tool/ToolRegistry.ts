import type { OpenAiToolSchema, ToolInvocation, ToolOutput } from '../../shared/agent/tools'
import {
  auditEntryAllow,
  auditEntryDenyByPolicy,
  auditEntryError,
  isPolicyDenyMessage,
  serializeToolArgs,
  shouldAuditTool
} from '../../shared/auditLog'
import { getSharedAuditLog } from '../logging/logService'
import { appLogger } from '../logging/AppFileLogger'
import { PathGuard } from '../policy/PathGuard'
import { registerAllBuiltinTools } from './builtins'

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
  private mcpHandlers = new Map<string, ToolHandler>()

  private get audit() {
    return getSharedAuditLog()
  }

  register(tool: RegisteredTool): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * 注册全部内置工具（对齐 hancli ToolRegistry 构造函数中的分组 register* 调用）。
   */
  registerBuiltins(): void {
    registerAllBuiltinTools(this)
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
    const argsJson = serializeToolArgs(inv.arguments)
    const start = performance.now()
    const elapsed = (): number => Math.round(performance.now() - start)

    if (!tool) {
      const message = `未知工具: ${inv.name}`
      if (shouldAuditTool(inv.name)) {
        await this.audit.record(auditEntryError(inv.name, argsJson, message, elapsed()))
      }
      return { success: false, content: '', error: message }
    }

    try {
      const result = await tool.handler(inv.arguments ?? {})
      if (shouldAuditTool(inv.name)) {
        if (result.success) {
          await this.audit.record(auditEntryAllow(inv.name, argsJson, elapsed()))
          appLogger.info('tool', `${inv.name} allow (${elapsed()}ms)`)
        } else {
          await this.audit.record(
            auditEntryError(inv.name, argsJson, result.error ?? '失败', elapsed())
          )
        }
      }
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (shouldAuditTool(inv.name)) {
        if (isPolicyDenyMessage(message)) {
          await this.audit.record(auditEntryDenyByPolicy(inv.name, argsJson, message, elapsed()))
        } else {
          await this.audit.record(auditEntryError(inv.name, argsJson, message, elapsed()))
        }
      }
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
