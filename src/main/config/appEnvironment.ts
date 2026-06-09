import { app } from 'electron'
import { join } from 'path'
import {
  APP_PROFILE_LABELS,
  TEST_JAVA_PORT,
  USER_JAVA_PORT,
  type AppEnvironmentInfo,
  type AppProfile
} from '../../shared/appEnvironment'
import { getAppSettings } from './appSettingsService'
import {
  getAgentWorkspacePath,
  getKnowledgeLibraryPath,
  getWorkspaceRoot,
  isCustomWorkspaceRoot,
  resolveDefaultWorkspaceRoot
} from './workspaceRootService'

const USER_USER_DATA_DIR = 'hanstudy-reader'
const TEST_USER_DATA_DIR = 'hanstudy-reader-test'
const USER_LIBRARY_SEGMENTS = ['寒的学习助手', '资料库'] as const
const TEST_LIBRARY_SEGMENTS = ['寒的学习助手-测试', '资料库'] as const

function resolveProfile(): AppProfile {
  const override = process.env.HANSTUDY_PROFILE?.trim().toLowerCase()
  if (override === 'user' || override === 'test') return override
  return app.isPackaged ? 'user' : 'test'
}

let cachedProfile: AppProfile | null = null

export function getAppProfile(): AppProfile {
  if (!cachedProfile) cachedProfile = resolveProfile()
  return cachedProfile
}

export function isTestProfile(): boolean {
  return getAppProfile() === 'test'
}

function documentsLibraryRoot(segments: readonly string[]): string {
  return join(app.getPath('documents'), ...segments)
}

function userLegacyLibraryRoot(): string {
  return join(app.getPath('appData'), USER_USER_DATA_DIR, 'data', 'local-library')
}

/** @deprecated 使用 getKnowledgeLibraryPath */
export function resolveLocalLibraryRoot(): string {
  return getKnowledgeLibraryPath()
}

function resolveOtherLocalLibraryRoots(): string[] {
  if (isTestProfile()) {
    return [documentsLibraryRoot(USER_LIBRARY_SEGMENTS), userLegacyLibraryRoot()]
  }
  return [documentsLibraryRoot(TEST_LIBRARY_SEGMENTS)]
}

function normalizePathForCompare(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

export function isOtherEnvironmentPath(filePath: string): boolean {
  const normalized = normalizePathForCompare(filePath)
  return resolveOtherLocalLibraryRoots().some((root) => {
    const normalizedRoot = normalizePathForCompare(root)
    return normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`)
  })
}

export function applyAppEnvironment(): void {
  if (process.platform === 'win32') {
    app.setAppUserModelId(
      isTestProfile() ? 'com.hanstudy.reader.test' : 'com.hanstudy.reader'
    )
  }

  const userDataDir = isTestProfile() ? TEST_USER_DATA_DIR : USER_USER_DATA_DIR
  app.setPath('userData', join(app.getPath('appData'), userDataDir))
}

export function resolveJavaBackendPort(): number {
  const raw = process.env.HANSTUDY_JAVA_PORT
  if (raw) {
    const port = Number.parseInt(raw, 10)
    if (Number.isFinite(port) && port > 0 && port <= 65535) return port
  }
  return isTestProfile() ? TEST_JAVA_PORT : USER_JAVA_PORT
}

export function shouldEnforceSingleInstance(): boolean {
  return !isTestProfile()
}

export async function getAppEnvironmentInfo(): Promise<AppEnvironmentInfo> {
  const settings = await getAppSettings()
  const profile = getAppProfile()
  const workspaceRoot = getWorkspaceRoot()
  const defaultWorkspaceRoot = resolveDefaultWorkspaceRoot()
  return {
    profile,
    profileLabel: APP_PROFILE_LABELS[profile],
    javaPort: resolveJavaBackendPort(),
    userDataPath: app.getPath('userData'),
    workspaceRoot,
    agentWorkspacePath: getAgentWorkspacePath(),
    localLibraryPath: getKnowledgeLibraryPath(),
    defaultWorkspaceRoot,
    workspaceRootIsCustom: isCustomWorkspaceRoot(settings)
  }
}
