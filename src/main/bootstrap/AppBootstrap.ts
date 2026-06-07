import { app, dialog, session } from 'electron'
import { hasJavaBackendJar, startJavaBackend, stopJavaBackend } from '../runtime/javaBridge'
import { initSkillService } from '../skill/skillService'
import { registerBuiltinTools } from '../tool/builtins/registerBuiltinTools'
import { getAppContext } from './AppContext'
import { createMainWindow } from './createWindow'
import { registerAllHandlers } from '../ipc/registerAllHandlers'
import { ensureLocalLibraryDir } from '../infra/localLibraryService'
import { destroyWebGuest } from '../web/webGuestService'

export async function startApp(): Promise<void> {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.hanstudy.reader')
  }

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
        dialog.showErrorBox(
          'Java 后端启动失败',
          `Java 后端未能启动，部分功能将不可用。\n\n${message}`
        )
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
  await ctx.mcpManager.startAll(ctx.toolRegistry)

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
