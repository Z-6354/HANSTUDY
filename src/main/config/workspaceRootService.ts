import { app } from 'electron'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { dirname, resolve } from 'path'
import type { AppSettings } from '../../shared/appSettings'
import {
  resolveAgentReadableRoots,
  resolveAgentWorkspacePath,
  resolveKnowledgeLibraryPath,
  workspaceLayoutDirs
} from '../../shared/workspaceLayout'
import { getAppContext } from '../bootstrap/AppContext'
import { initLogging } from '../logging/logService'
import { reloadSkills, setProjectSkillsDir } from '../skill/skillService'

let cachedProjectRoot: string | null = null

/** 未自定义时：打包版用 exe 所在目录，开发版用当前工作目录。 */
export function resolveDefaultWorkspaceRoot(): string {
  if (app.isPackaged) {
    return resolve(dirname(process.execPath))
  }
  return resolve(process.cwd())
}

export function resolveWorkspaceRoot(settings?: Pick<AppSettings, 'workspaceRoot'>): string {
  const custom = settings?.workspaceRoot?.trim()
  return custom ? resolve(custom) : resolveDefaultWorkspaceRoot()
}

/** HanStudy 项目根目录（设置页「工作区路径」、.hanstudy 配置所在位置）。 */
export function getWorkspaceRoot(): string {
  if (!cachedProjectRoot) {
    cachedProjectRoot = resolveDefaultWorkspaceRoot()
  }
  return cachedProjectRoot
}

export function getAgentWorkspacePath(): string {
  return resolveAgentWorkspacePath(getWorkspaceRoot())
}

export function getKnowledgeLibraryPath(): string {
  return resolveKnowledgeLibraryPath(getWorkspaceRoot())
}

export function isCustomWorkspaceRoot(settings: Pick<AppSettings, 'workspaceRoot'>): boolean {
  return Boolean(settings.workspaceRoot?.trim())
}

export async function ensureWorkspaceDir(settings?: Pick<AppSettings, 'workspaceRoot'>): Promise<string> {
  const projectRoot = resolveWorkspaceRoot(settings)
  for (const dir of workspaceLayoutDirs(projectRoot)) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
  }
  cachedProjectRoot = projectRoot
  return projectRoot
}

export function applyWorkspaceRootSync(projectRoot: string): void {
  cachedProjectRoot = resolve(projectRoot)
  initLogging(cachedProjectRoot)
  setProjectSkillsDir(cachedProjectRoot)
  const ctx = getAppContext()
  ctx.setProjectRoot(cachedProjectRoot)
  ctx.setAgentReadableRoots(resolveAgentReadableRoots(cachedProjectRoot))
}

export async function applyWorkspaceRootFromSettings(
  settings: Pick<AppSettings, 'workspaceRoot'>
): Promise<void> {
  const root = await ensureWorkspaceDir(settings)
  applyWorkspaceRootSync(root)
  await reloadSkills()
}

export async function restartWorkspaceMcpServers(): Promise<void> {
  const ctx = getAppContext()
  try {
    await ctx.mcpManager.startAll(ctx.toolRegistry)
  } catch (err) {
    console.error('[workspaceRoot] MCP restart failed:', err)
  }
}
