import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => (name === 'userData' ? 'C:\\\\mock-user-data' : 'C:\\\\mock')
  }
}))

import { PathGuard } from '../src/main/policy/PathGuard'
import { ToolRegistry } from '../src/main/tool/ToolRegistry'
import { BUILTIN_TOOLS, requiresHitlApproval } from '../src/shared/agent/tools'

describe('PathGuard', () => {
  it('allows paths under workspace root', () => {
    const guard = new PathGuard()
    guard.setWorkspaceRoot('D:\\books')
    expect(() => guard.assertAllowed('D:\\books\\a.md')).not.toThrow()
  })

  it('rejects paths outside workspace', () => {
    const guard = new PathGuard()
    guard.setWorkspaceRoot('D:\\books')
    expect(() => guard.assertAllowed('C:\\secret.txt')).toThrow(/不在允许范围/)
  })

  it('allows userData paths when workspace is null (doc 01)', () => {
    const guard = new PathGuard()
    guard.setWorkspaceRoot(null)
    expect(() => guard.assertAllowed('C:\\\\mock-user-data\\annotations.json')).not.toThrow()
  })

  it('allows single-file parent directory as workspace root (doc 01)', () => {
    const guard = new PathGuard()
    guard.setWorkspaceRoot('D:\\books\\chapter1')
    expect(() => guard.assertAllowed('D:\\books\\chapter1\\readme.md')).not.toThrow()
    expect(() => guard.assertAllowed('D:\\books\\other.md')).toThrow()
  })
})

describe('ToolRegistry', () => {
  it('registers and executes builtin tool handler', async () => {
    const registry = new ToolRegistry()
    registry.register({
      name: 'echo',
      description: 'echo',
      parameters: { type: 'object', properties: {} },
      handler: async (args) => ({ success: true, content: String(args.text ?? '') })
    })
    const out = await registry.executeTool({
      id: '1',
      name: 'echo',
      arguments: { text: 'hi' }
    })
    expect(out.success).toBe(true)
    expect(out.content).toBe('hi')
  })

  it('exports builtin tool names', () => {
    expect(BUILTIN_TOOLS.readDocument).toBe('read_document')
    expect(BUILTIN_TOOLS.loadSkill).toBe('load_skill')
  })
})

describe('HITL policy', () => {
  it('requires approval for MCP tools', () => {
    expect(requiresHitlApproval('mcp__server__tool')).toBe(true)
    expect(requiresHitlApproval('read_document')).toBe(false)
  })
})
