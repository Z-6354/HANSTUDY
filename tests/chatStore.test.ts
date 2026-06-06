/**
 * doc 09 — 多会话 streaming / requestSessionMap
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { clearMockLocalStorage } from './setup'

async function getStore() {
  const { useChatStore } = await import('../src/renderer/src/stores/chatStore')
  return useChatStore
}

describe('chatStore streaming (doc 09)', () => {
  beforeEach(() => {
    clearMockLocalStorage()
  })

  it('startStream maps requestId to sessionId', async () => {
    const useChatStore = await getStore()
    useChatStore.getState().startStream('sess-a', 'req-1', 'asst-1')
    expect(useChatStore.getState().getSessionForRequest('req-1')).toBe('sess-a')
    expect(useChatStore.getState().isSessionStreaming('sess-a')).toBe(true)
  })

  it('parallel streams on different sessions do not collide', async () => {
    const useChatStore = await getStore()
    const s = useChatStore.getState()
    s.startStream('sess-a', 'req-1', 'asst-1')
    s.startStream('sess-b', 'req-2', 'asst-2')
    expect(s.getSessionForRequest('req-1')).toBe('sess-a')
    expect(s.getSessionForRequest('req-2')).toBe('sess-b')
    expect(s.isSessionStreaming('sess-a')).toBe(true)
    expect(s.isSessionStreaming('sess-b')).toBe(true)
  })

  it('finishStream clears only matching request', async () => {
    const useChatStore = await getStore()
    const s = useChatStore.getState()
    s.startStream('sess-a', 'req-1', 'asst-1')
    s.startStream('sess-b', 'req-2', 'asst-2')
    s.finishStream('req-1')
    expect(s.isSessionStreaming('sess-a')).toBe(false)
    expect(s.isSessionStreaming('sess-b')).toBe(true)
    expect(s.getSessionForRequest('req-1')).toBeUndefined()
  })

  it('updateStreamToolSteps stores toolCallId as step id', async () => {
    const useChatStore = await getStore()
    const s = useChatStore.getState()
    s.startStream('sess-a', 'req-1', 'asst-1')
    s.updateStreamToolSteps('sess-a', () => [
      { id: 'call-abc', name: 'read_document', status: 'done', output: 'ok' }
    ])
    const steps = s.getStream('sess-a')?.toolSteps ?? []
    expect(steps[0]?.id).toBe('call-abc')
  })

  it('finishStream persists toolSteps on assistant message', async () => {
    const useChatStore = await getStore()
    const s = useChatStore.getState()
    const sessionId = s.createSession()
    s.addMessage(sessionId, {
      id: 'asst-1',
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString()
    })
    s.startStream(sessionId, 'req-1', 'asst-1')
    s.updateStreamToolSteps(sessionId, () => [
      { id: 'call-1', name: 'read_document', status: 'done', output: 'ok' }
    ])
    s.finishStream('req-1')
    const msg = s.loadForDoc(sessionId).find((m) => m.id === 'asst-1')
    expect(msg?.toolSteps?.[0]?.name).toBe('read_document')
    expect(s.getStream(sessionId)).toBeUndefined()
  })

  it('deleteSession clears active stream for that session', async () => {
    const useChatStore = await getStore()
    const s = useChatStore.getState()
    const id = s.createSession()
    s.startStream(id, 'req-x', 'asst-x')
    s.deleteSession(id)
    expect(s.isSessionStreaming(id)).toBe(false)
  })
})
