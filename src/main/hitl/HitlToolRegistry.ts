import type { IpcMainEvent, WebContents } from 'electron'
import type { ToolInvocation, ToolOutput } from '../../shared/agent/tools'
import { requiresHitlApproval } from '../../shared/agent/tools'
import {
  auditEntryDenyByHitl,
  auditEntryError,
  serializeToolArgs,
  shouldAuditTool
} from '../../shared/auditLog'
import { IPC } from '../../shared/ipc/channels'
import { getAppSettings } from '../config/appSettingsService'
import { getSharedAuditLog } from '../logging/logService'
import type { ToolRegistry } from '../tool/ToolRegistry'

interface PendingHitl {
  chatRequestId: string
  resolve: (approved: boolean | 'unavailable') => void
  timer: ReturnType<typeof setTimeout>
}

export class HitlToolRegistry {
  private pending = new Map<string, PendingHitl>()

  private get audit() {
    return getSharedAuditLog()
  }

  constructor(
    private readonly inner: ToolRegistry,
    private getWebContents: () => WebContents | null
  ) {}

  resolveHitl(hitlRequestId: string, approved: boolean): void {
    const p = this.pending.get(hitlRequestId)
    if (!p) return
    clearTimeout(p.timer)
    this.pending.delete(hitlRequestId)
    p.resolve(approved)
  }

  /** 中止 AI 请求时拒绝待审批，可选仅拒绝某次 chat */
  rejectAllPending(chatRequestId?: string): void {
    for (const id of Array.from(this.pending.keys())) {
      const p = this.pending.get(id)
      if (!p) continue
      if (chatRequestId && p.chatRequestId !== chatRequestId) continue
      clearTimeout(p.timer)
      this.pending.delete(id)
      p.resolve(false)
    }
  }

  private async shouldAutoApprove(toolName: string): Promise<boolean> {
    if (!requiresHitlApproval(toolName)) return true
    const settings = await getAppSettings()
    return settings.hitlAutoApprove
  }

  private async requestApproval(
    chatRequestId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<boolean | 'timeout' | 'unavailable'> {
    if (await this.shouldAutoApprove(toolName)) return true
    const wc = this.getWebContents()
    if (!wc) return 'unavailable'

    const hitlRequestId = `hitl-${chatRequestId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    return new Promise<boolean | 'timeout' | 'unavailable'>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(hitlRequestId)
        resolve('timeout')
      }, 120_000)
      this.pending.set(hitlRequestId, { chatRequestId, resolve, timer })
      wc.send(IPC.ai.hitlRequest, chatRequestId, hitlRequestId, toolName, args)
    })
  }

  async executeTool(
    inv: ToolInvocation,
    chatRequestId: string,
    onStart?: () => void
  ): Promise<ToolOutput> {
    const argsJson = serializeToolArgs(inv.arguments)
    const start = performance.now()
    const elapsed = (): number => Math.round(performance.now() - start)

    const approved = await this.requestApproval(chatRequestId, inv.name, inv.arguments ?? {})
    if (approved === 'timeout') {
      const reason = '工具审批超时（120 秒）'
      if (shouldAuditTool(inv.name)) {
        await this.audit.record(auditEntryDenyByHitl(inv.name, argsJson, reason, elapsed()))
      }
      return { success: false, content: '', error: reason }
    }
    if (approved === 'unavailable') {
      const reason = '无法显示审批窗口（窗口未就绪）'
      if (shouldAuditTool(inv.name)) {
        await this.audit.record(auditEntryError(inv.name, argsJson, reason, elapsed()))
      }
      return { success: false, content: '', error: reason }
    }
    if (!approved) {
      const reason = '用户拒绝执行该工具'
      if (shouldAuditTool(inv.name)) {
        await this.audit.record(auditEntryDenyByHitl(inv.name, argsJson, reason, elapsed()))
      }
      return { success: false, content: '', error: reason }
    }

    onStart?.()
    return this.inner.executeTool(inv)
  }

  async executeTools(
    invs: ToolInvocation[],
    chatRequestId: string,
    maxParallel = 4,
    onStart?: (inv: ToolInvocation) => void,
    onDone?: (inv: ToolInvocation, output: ToolOutput) => void,
    signal?: AbortSignal
  ): Promise<ToolOutput[]> {
    const abortedOutput = (): ToolOutput => ({
      success: false,
      content: '',
      error: '已中止'
    })

    const results: ToolOutput[] = new Array(invs.length)
    let index = 0
    const workers = Array.from({ length: Math.min(maxParallel, invs.length) }, async () => {
      while (index < invs.length) {
        if (signal?.aborted) {
          const i = index++
          results[i] = abortedOutput()
          onDone?.(invs[i], results[i])
          continue
        }
        const i = index++
        const inv = invs[i]
        results[i] = await this.executeTool(inv, chatRequestId, () => onStart?.(inv))
        onDone?.(inv, results[i])
      }
    })
    await Promise.all(workers)
    return results
  }

  getOpenAiSchemas() {
    return this.inner.getOpenAiSchemas()
  }

  get innerRegistry(): ToolRegistry {
    return this.inner
  }
}

export function registerHitlIpc(
  ipcMain: { on: (channel: string, listener: (event: IpcMainEvent, ...args: unknown[]) => void) => void },
  hitl: HitlToolRegistry
): void {
  ipcMain.on(IPC.ai.hitlResponse, (_event, hitlRequestId: unknown, approved: unknown) => {
    if (typeof hitlRequestId !== 'string') return
    hitl.resolveHitl(hitlRequestId, Boolean(approved))
  })
}
