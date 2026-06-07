import { BrowserWindow, app, shell } from 'electron'
import { join } from 'path'
import { IPC } from '../../shared/ipc/channels'
import { initWebGuestService } from '../web/webGuestService'
import { getAppContext } from './AppContext'
import { lockPageZoomForWindow } from './pageZoomLock'

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

  const lockPageZoom = (): void => {
    lockPageZoomForWindow(win)
  }

  win.webContents.on('did-finish-load', lockPageZoom)
  win.webContents.on('zoom-changed', lockPageZoom)

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

  // 阻止系统级 F11 全屏；禁止 Chromium 整页缩放（Ctrl+滚轮 / pinch / 快捷键）
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault()
      return
    }

    if (input.type === 'mouseWheel' && (input.control || input.meta)) {
      event.preventDefault()
      lockPageZoom()
      return
    }

    if (
      input.type === 'gestureBegin' ||
      input.type === 'gestureUpdate' ||
      input.type === 'gestureEnd'
    ) {
      event.preventDefault()
      lockPageZoom()
      return
    }

    if (input.type !== 'keyDown') return
    const mod = input.control || input.meta
    if (!mod) return
    const key = input.key
    if (key === '=' || key === '+' || key === '-' || key === '0' || key === 'Add' || key === 'Subtract') {
      event.preventDefault()
    }
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
