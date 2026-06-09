import { app, session } from 'electron'
import { hasJavaBackendJar, startJavaBackend, stopJavaBackend } from '../runtime/javaBridge'
import { initSkillService } from '../skill/skillService'
import { registerBuiltinTools } from '../tool/builtins/registerBuiltinTools'
import { getAppContext } from './AppContext'
import { createMainWindow } from './createWindow'
import { registerAllHandlers } from '../ipc/registerAllHandlers'
import { ensureLocalLibraryDir } from '../infra/localLibraryService'
import { destroyWebGuest } from '../web/webGuestService'

export async function startApp(): Promise<void> {
  setupWebviewSession()
  const ctx = getAppContext()

  if (hasJavaBackendJar()) {
    try {
      await startJavaBackend()
      console.log('[bootstrap] Java backend started')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[bootstrap] Java backend failed:', message)
      if (app.isPackaged) {
        console.warn('[bootstrap] Java backend unavailable in packaged app:', message)
      }
    }
  }

  try {
    await initSkillService()
    console.log('[bootstrap] Skill service initialized')
  } catch (err) {
    console.error('[bootstrap] Skill service failed:', err)
  }

  registerBuiltinTools(ctx.toolRegistry)
  const localLibraryRoot = await ensureLocalLibraryDir()
  ctx.setWorkspaceRoot(localLibraryRoot)
  ctx.initAgentStack()
  try {
    await ctx.mcpManager.startAll(ctx.toolRegistry)
  } catch (err) {
    console.error('[bootstrap] MCP servers failed to start:', err)
  }

  registerAllHandlers()
  createMainWindow()
}

export async function shutdownApp(): Promise<void> {
  const ctx = getAppContext()
  for (const controller of Array.from(ctx.activeAiAborts.values())) {
    controller.abort()
  }
  ctx.activeAiAborts.clear()
  await ctx.mcpManager.shutdown(ctx.toolRegistry)
  destroyWebGuest()
  await stopJavaBackend()
}

function setupWebviewSession(): void {
  const webPartition = session.fromPartition('persist:hanstudy-web')
  const ua = webPartition
    .getUserAgent()
    .replace(/\sElectron\/[^\s]+/g, '')
    .replace(/\sHanStudy[^\s]*/gi, '')
    .trim()
  if (ua) webPartition.setUserAgent(ua)
  webPartition.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(true)
  })
}
