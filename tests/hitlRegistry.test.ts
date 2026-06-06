/**
 * doc 01/08 — HITL 队列与 abort 隔离
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/mock-user-data' }
}))

vi.mock('../src/main/config/appSettingsService', () => ({
  getAppSettings: vi.fn(async () => ({
    searchEngine: 'bing',
    webBrowseHideSidebar: true,
    webBrowseHideAIPanel: true,
    hitlAutoApprove: false
  }))
}))

describe('HitlToolRegistry (doc 01/08)', () => {
  let HitlToolRegistry: typeof import('../src/main/hitl/HitlToolRegistry').HitlToolRegistry
  let ToolRegistry: typeof import('../src/main/tool/ToolRegistry').ToolRegistry

  beforeAll(async () => {
    ;({ HitlToolRegistry } = await import('../src/main/hitl/HitlToolRegistry'))
    ;({ ToolRegistry } = await import('../src/main/tool/ToolRegistry'))
  })

  it('onStart fires only after approval', async () => {
    const inner = new ToolRegistry()
    inner.register({
      name: 'mcp__s__t',
      description: 't',
      parameters: { type: 'object', properties: {} },
      handler: async () => ({ success: true, content: 'done' })
    })
    const sends: unknown[][] = []
    const hitl = new HitlToolRegistry(inner, () => ({
      send: (_ch: string, ...args: unknown[]) => {
        sends.push(args)
      }
    }) as never)

    const onStart = vi.fn()
    const p = hitl.executeTool(
      { id: '1', name: 'mcp__s__t', arguments: {} },
      'chat-req-1',
      onStart
    )

    await vi.waitFor(() => {
      expect(sends.length).toBeGreaterThan(0)
    })
    expect(onStart).not.toHaveBeenCalled()
    const hitlId = sends[0]?.[1] as string
    hitl.resolveHitl(hitlId, true)
    await p
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('rejectAllPending only rejects matching chatRequestId', async () => {
    const inner = new ToolRegistry()
    inner.register({
      name: 'mcp__a__x',
      description: 'x',
      parameters: { type: 'object', properties: {} },
      handler: async () => ({ success: true, content: 'x' })
    })
    const sendCount = { n: 0 }
    const hitl = new HitlToolRegistry(inner, () => ({
      send: () => {
        sendCount.n += 1
      }
    }) as never)

    const p1 = hitl.executeTool({ id: '1', name: 'mcp__a__x', arguments: {} }, 'chat-A')
    const p2 = hitl.executeTool({ id: '2', name: 'mcp__a__x', arguments: {} }, 'chat-B')

    await vi.waitFor(() => expect(sendCount.n).toBe(2))

    hitl.rejectAllPending('chat-A')
    await expect(p1).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('拒绝')
    })

    hitl.rejectAllPending('chat-B')
    await expect(p2).resolves.toMatchObject({ success: false })
  }, 10_000)
})
