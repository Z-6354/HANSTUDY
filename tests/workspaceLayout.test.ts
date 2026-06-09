import { describe, expect, it } from 'vitest'
import { resolve } from 'path'
import {
  AGENT_WORKSPACE_DIR,
  APP_AUDIT_DIR,
  APP_LOGS_DIR,
  HANSTUDY_CONFIG_DIR,
  KNOWLEDGE_LIBRARY_DIR,
  resolveAgentReadableRoots,
  resolveAgentWorkspacePath,
  resolveAppAuditDir,
  resolveAppLogsDir,
  resolveHanstudyConfigPath,
  resolveKnowledgeLibraryPath,
  workspaceLayoutDirs
} from '../src/shared/workspaceLayout'

describe('workspaceLayout', () => {
  it('nests agent workspace and library under project root', () => {
    const projectRoot = 'D:\\hanstudy'
    expect(resolveAgentWorkspacePath(projectRoot)).toBe(
      resolve(projectRoot, AGENT_WORKSPACE_DIR)
    )
    expect(resolveKnowledgeLibraryPath(projectRoot)).toBe(
      resolve(projectRoot, AGENT_WORKSPACE_DIR, KNOWLEDGE_LIBRARY_DIR)
    )
    expect(resolveHanstudyConfigPath(projectRoot)).toBe(
      resolve(projectRoot, HANSTUDY_CONFIG_DIR)
    )
  })

  it('returns agent readable roots for PathGuard', () => {
    const projectRoot = 'D:\\hanstudy'
    expect(resolveAgentReadableRoots(projectRoot)).toEqual([
      resolve(projectRoot, AGENT_WORKSPACE_DIR),
      resolve(projectRoot, HANSTUDY_CONFIG_DIR)
    ])
  })

  it('resolves app log dirs under project root', () => {
    const projectRoot = 'D:\\hanstudy'
    expect(resolveAppLogsDir(projectRoot)).toBe(resolve(projectRoot, APP_LOGS_DIR))
    expect(resolveAppAuditDir(projectRoot)).toBe(resolve(projectRoot, APP_AUDIT_DIR))
  })

  it('returns all dirs to ensure on bootstrap', () => {
    const projectRoot = 'D:\\hanstudy'
    expect(workspaceLayoutDirs(projectRoot)).toEqual([
      resolve(projectRoot),
      resolve(projectRoot, AGENT_WORKSPACE_DIR),
      resolve(projectRoot, AGENT_WORKSPACE_DIR, KNOWLEDGE_LIBRARY_DIR),
      resolve(projectRoot, APP_LOGS_DIR),
      resolve(projectRoot, APP_AUDIT_DIR)
    ])
  })
})
