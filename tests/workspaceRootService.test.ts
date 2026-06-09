import { describe, expect, it, vi } from 'vitest'
import { resolve } from 'path'
import { AGENT_WORKSPACE_DIR, KNOWLEDGE_LIBRARY_DIR } from '../src/shared/workspaceLayout'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: (name: string) => (name === 'userData' ? 'C:\\mock-user-data' : 'C:\\mock')
  }
}))

import {
  getAgentWorkspacePath,
  getKnowledgeLibraryPath,
  resolveDefaultWorkspaceRoot,
  resolveWorkspaceRoot
} from '../src/main/config/workspaceRootService'

describe('workspaceRootService', () => {
  it('uses cwd as default project root in development', () => {
    expect(resolveDefaultWorkspaceRoot()).toBe(resolve(process.cwd()))
  })

  it('uses custom project root when configured', () => {
    expect(resolveWorkspaceRoot({ workspaceRoot: 'D:\\my-project' })).toBe('D:\\my-project')
  })

  it('falls back to default when workspaceRoot is null', () => {
    expect(resolveWorkspaceRoot({ workspaceRoot: null })).toBe(resolveDefaultWorkspaceRoot())
  })

  it('derives agent and library paths from cached project root', async () => {
    const { ensureWorkspaceDir } = await import('../src/main/config/workspaceRootService')
    await ensureWorkspaceDir({ workspaceRoot: 'D:\\proj' })
    expect(getAgentWorkspacePath()).toBe(resolve('D:\\proj', AGENT_WORKSPACE_DIR))
    expect(getKnowledgeLibraryPath()).toBe(
      resolve('D:\\proj', AGENT_WORKSPACE_DIR, KNOWLEDGE_LIBRARY_DIR)
    )
  })
})
