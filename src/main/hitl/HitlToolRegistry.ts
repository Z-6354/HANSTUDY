import type { IpcMainEvent, WebContents } from 'electron'

import type { ToolInvocation, ToolOutput } from '../../shared/agent/tools'

import { requiresHitlApproval } from '../../shared/agent/tools'

import { IPC } from '../../shared/ipc/channels'

import { getAppSettings } from '../config/appSettingsService'

import type { ToolRegistry } from '../tool/ToolRegistry'



interface PendingHitl {

  chatRequestId: string

  resolve: (approved: boolean | 'unavailable') => void

  timer: ReturnType<typeof setTimeout>

}



export class HitlToolRegistry {

  private pending = new Map<string, PendingHitl>()



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

      this.pending.set(hitlRequestId, {

        chatRequestId,

        resolve,

        timer

      })

      wc.send(IPC.ai.hitlRequest, chatRequestId, hitlRequestId, toolName, args)

    })

  }



  async executeTool(

    inv: ToolInvocation,

    chatRequestId: string,

    onStart?: () => void

  ): Promise<ToolOutput> {

    const approved = await this.requestApproval(chatRequestId, inv.name, inv.arguments ?? {})

    if (approved === 'timeout') {

      return { success: false, content: '', error: '工具审批超时（120 秒）' }

    }

    if (approved === 'unavailable') {

      return { success: false, content: '', error: '无法显示审批窗口（窗口未就绪）' }

    }

    if (!approved) {

      return { success: false, content: '', error: '用户拒绝执行该工具' }

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


