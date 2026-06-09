import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => (name === 'userData' ? 'C:\\\\mock-user-data' : 'C:\\\\mock')
  }
}))

import { PathGuard, normalizeLocalFilePath } from '../src/main/policy/PathGuard'
import { ToolRegistry } from '../src/main/tool/ToolRegistry'
import { BUILTIN_TOOLS, requiresHitlApproval } from '../src/shared/agent/tools'

describe('PathGuard', () => {
  // 以下路径均为测试用占位符，与真实安装位置无关；运行时由 workspaceRootService 解析实际目录。
  const mockBooksRoot = 'D:\\mock-books'
  const mockProjectRoot = 'D:\\mock-any-install-path'
  const mockAgentWorkspace = `${mockProjectRoot}\\workspace`
  const mockHanstudyConfig = `${mockProjectRoot}\\.hanstudy`
  const mockLoadedFolder = 'E:\\mock-user-opened-folder'

  it('allows paths under workspace root', () => {
    const guard = new PathGuard()
    guard.setWorkspaceRoot(mockBooksRoot)
    expect(() => guard.assertAllowed(`${mockBooksRoot}\\a.md`)).not.toThrow()
  })

  it('rejects paths outside workspace', () => {
    const guard = new PathGuard()
    guard.setWorkspaceRoot(mockBooksRoot)
    expect(() => guard.assertAllowed('C:\\unrelated-secret.txt')).toThrow(/不在允许范围/)
  })

  it('allows userData paths when workspace is null (doc 01)', () => {
    const guard = new PathGuard()
    guard.setWorkspaceRoot(null)
    expect(() => guard.assertAllowed('C:\\\\mock-user-data\\annotations.json')).not.toThrow()
  })

  it('allows single-file parent directory as workspace root (doc 01)', () => {
    const chapterRoot = `${mockBooksRoot}\\chapter1`
    const guard = new PathGuard()
    guard.setWorkspaceRoot(chapterRoot)
    expect(() => guard.assertAllowed(`${chapterRoot}\\readme.md`)).not.toThrow()
    expect(() => guard.assertAllowed(`${mockBooksRoot}\\sibling.md`)).toThrow()
  })

  it('allows agent workspace, hanstudy config, and loaded folders', () => {
    const guard = new PathGuard()
    guard.setAgentRoots([mockAgentWorkspace, mockHanstudyConfig])
    guard.setLoadedFolder(mockLoadedFolder)
    expect(() => guard.assertAllowed(`${mockAgentWorkspace}\\library\\paper.pdf`)).not.toThrow()
    expect(() => guard.assertAllowed(`${mockAgentWorkspace}\\src\\main.ts`)).not.toThrow()
    expect(() => guard.assertAllowed(`${mockHanstudyConfig}\\mcp.json`)).not.toThrow()
    expect(() => guard.assertAllowed(`${mockHanstudyConfig}\\skills\\demo\\SKILL.md`)).not.toThrow()
    expect(() => guard.assertAllowed(`${mockLoadedFolder}\\readme.md`)).not.toThrow()
    // 项目根下但未在允许子目录内的文件仍应拒绝
    expect(() => guard.assertAllowed(`${mockProjectRoot}\\other.txt`)).toThrow()
    expect(() => guard.assertAllowed('C:\\unrelated-secret.txt')).toThrow()
  })

  it('accepts file:// URLs under allowed roots', () => {
    const guard = new PathGuard()
    guard.setAgentRoots([mockAgentWorkspace, mockHanstudyConfig])
    const fileUrl = `file:///${mockAgentWorkspace.replace(/\\/g, '/')}/library/paper.pdf`
    expect(() => guard.assertAllowed(fileUrl)).not.toThrow()
    expect(guard.resolveAllowed(fileUrl)).toBe(`${mockAgentWorkspace}\\library\\paper.pdf`)
    expect(normalizeLocalFilePath(fileUrl)).toBe(`${mockAgentWorkspace}\\library\\paper.pdf`)
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

  it('registerBuiltins exposes library tools', () => {
    const registry = new ToolRegistry()
    registry.registerBuiltins()
    const schemas = registry.getOpenAiSchemas()
    const names = schemas.map((s) => s.function.name)
    expect(names).toContain(BUILTIN_TOOLS.listLibrary)
    expect(names).toContain(BUILTIN_TOOLS.globLibrary)
    expect(names).toContain(BUILTIN_TOOLS.searchInLibrary)
    expect(names).toContain(BUILTIN_TOOLS.readDocumentRange)
    expect(names).toContain(BUILTIN_TOOLS.parsePdf)
    expect(names).toContain(BUILTIN_TOOLS.getReadingProgress)
    expect(names).toContain(BUILTIN_TOOLS.readNote)
    expect(names).toContain(BUILTIN_TOOLS.searchNotes)
  })

  it('exports builtin tool names', () => {
    expect(BUILTIN_TOOLS.readDocument).toBe('read_document')
    expect(BUILTIN_TOOLS.listLibrary).toBe('list_library')
    expect(BUILTIN_TOOLS.loadSkill).toBe('load_skill')
  })
})

describe('HITL policy', () => {
  it('requires approval for MCP tools', () => {
    expect(requiresHitlApproval('mcp__server__tool')).toBe(true)
    expect(requiresHitlApproval('read_document')).toBe(false)
  })
})
