import { app, session } from 'electron'
import { hasJavaBackendJar, startJavaBackend, stopJavaBackend } from '../runtime/javaBridge'
import { initSkillService } from '../skill/skillService'
import { getAppContext } from './AppContext'
import { createMainWindow } from './createWindow'
import { registerAllHandlers } from '../ipc/registerAllHandlers'
import { getAppSettings } from '../config/appSettingsService'
import { applyWorkspaceRootFromSettings, restartWorkspaceMcpServers } from '../config/workspaceRootService'
import { destroyWebGuest } from '../web/webGuestService'
import { appLogger } from '../logging/AppFileLogger'

export async function startApp(): Promise<void> {
  setupWebviewSession()
  const settings = await getAppSettings()
  await applyWorkspaceRootFromSettings(settings)
  appLogger.info('bootstrap', 'HanStudy starting')

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

  ctx.toolRegistry.registerBuiltins()
  ctx.initAgentStack()

  registerAllHandlers()
  createMainWindow()

  void restartWorkspaceMcpServers().catch((err) => {
    console.error('[bootstrap] MCP servers failed to start:', err)
  })
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
