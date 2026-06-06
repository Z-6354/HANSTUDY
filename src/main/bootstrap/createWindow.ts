import { BrowserWindow, app, shell } from 'electron'
import { join } from 'path'
import { IPC } from '../../shared/ipc/channels'
import { initWebGuestService } from '../web/webGuestService'
import { getAppContext } from './AppContext'

const isDev = !app.isPackaged

export function createMainWindow(): BrowserWindow {
  const context = getAppContext()
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  })

  context.mainWindow = win

  const notifyMaximizeChanged = (): void => {
    if (!win) return
    win.webContents.send(IPC.window.maximizedChanged, win.isMaximized())
  }

  win.on('maximize', notifyMaximizeChanged)
  win.on('unmaximize', notifyMaximizeChanged)

  win.on('ready-to-show', () => {
    win.maximize()
    win.show()
    notifyMaximizeChanged()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  win.webContents.on('will-attach-webview', (_event, webPreferences) => {
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.javascript = true
    webPreferences.webgl = true
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  initWebGuestService(win)
  return win
}
