import { resolve } from 'path'
import {
  AGENT_WORKSPACE_DIR,
  APP_AUDIT_DIR,
  APP_LOGS_DIR,
  HANSTUDY_CONFIG_DIR,
  KNOWLEDGE_LIBRARY_DIR
} from './workspaceLayoutConstants'

export {
  AGENT_WORKSPACE_DIR,
  APP_AUDIT_DIR,
  APP_LOGS_DIR,
  HANSTUDY_CONFIG_DIR,
  KNOWLEDGE_LIBRARY_DIR
} from './workspaceLayoutConstants'

export function resolveHanstudyConfigPath(projectRoot: string): string {
  return resolve(projectRoot, HANSTUDY_CONFIG_DIR)
}

export function resolveAgentWorkspacePath(projectRoot: string): string {
  return resolve(projectRoot, AGENT_WORKSPACE_DIR)
}

export function resolveKnowledgeLibraryPath(projectRoot: string): string {
  return resolve(resolveAgentWorkspacePath(projectRoot), KNOWLEDGE_LIBRARY_DIR)
}

export function resolveAppLogsDir(projectRoot: string): string {
  return resolve(projectRoot, APP_LOGS_DIR)
}

export function resolveAppAuditDir(projectRoot: string): string {
  return resolve(projectRoot, APP_AUDIT_DIR)
}

export function workspaceLayoutDirs(projectRoot: string): string[] {
  const agentRoot = resolveAgentWorkspacePath(projectRoot)
  return [
    projectRoot,
    agentRoot,
    resolveKnowledgeLibraryPath(projectRoot),
    resolveAppLogsDir(projectRoot),
    resolveAppAuditDir(projectRoot)
  ]
}

export function resolveAgentReadableRoots(projectRoot: string): string[] {
  return [resolveAgentWorkspacePath(projectRoot), resolveHanstudyConfigPath(projectRoot)]
}
