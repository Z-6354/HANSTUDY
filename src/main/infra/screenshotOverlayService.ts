import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { IPC } from '../../shared/ipc/channels'
import type { ScreenshotInitPayload, ScreenshotPickResult } from '../../shared/screenshot'
import { captureMainWindowFrame } from './screenshotService'
import { compressCapturedDataUrl } from './imagePayloadService'

const isDev = !app.isPackaged

let overlayWindow: BrowserWindow | null = null
let pendingResolve: ((value: ScreenshotPickResult | null) => void) | null = null
let pendingReadyResolve: ((value: void) => void) | null = null

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cleanupOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close()
  }
  overlayWindow = null
  pendingReadyResolve = null
}

function resolvePending(result: ScreenshotPickResult | null): void {
  const resolve = pendingResolve
  pendingResolve = null
  resolve?.(result)
}

function loadOverlayPage(win: BrowserWindow): void {
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/screenshot-overlay.html`)
    return
  }
  void win.loadFile(join(__dirname, '../renderer/screenshot-overlay.html'))
}

function createOverlayWindow(bounds: Electron.Rectangle): BrowserWindow {
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    show: false,
    backgroundColor: '#f3f3f3',
    autoHideMenuBar: true,
    parent: undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.on('closed', () => {
    if (overlayWindow === win) {
      overlayWindow = null
    }
    if (pendingResolve) {
      resolvePending(null)
    }
    pendingReadyResolve = null
  })

  return win
}

function waitForOverlayReady(win: BrowserWindow, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    if (win.isDestroyed()) {
      resolve()
      return
    }
    const timer = setTimeout(() => {
      pendingReadyResolve = null
      resolve()
    }, timeoutMs)
    pendingReadyResolve = () => {
      clearTimeout(timer)
      pendingReadyResolve = null
      resolve()
    }
  })
}

export function notifyScreenshotOverlayReady(): void {
  pendingReadyResolve?.()
}

export function submitScreenshotRegion(dataUrl: string): void {
  const resolve = pendingResolve
  pendingResolve = null
  cleanupOverlay()
  let finalUrl = dataUrl
  try {
    finalUrl = compressCapturedDataUrl(dataUrl)
  } catch {
    // 保留原图
  }
  resolve?.({ dataUrl: finalUrl })
}

export function cancelScreenshotRegion(): void {
  const resolve = pendingResolve
  pendingResolve = null
  cleanupOverlay()
  resolve?.(null)
}

/** 截取本应用窗口内容，框选区域 */
export async function pickScreenshotRegion(
  mainWindow: BrowserWindow
): Promise<ScreenshotPickResult | null> {
  if (pendingResolve) {
    throw new Error('截图正在进行中')
  }

  const wasMinimized = mainWindow.isMinimized()
  const wasVisible = mainWindow.isVisible()

  if (wasMinimized) {
    mainWindow.restore()
    await delay(120)
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show()
    await delay(80)
  }
  mainWindow.focus()
  await delay(60)

  try {
    const bounds = mainWindow.getBounds()
    const frame = await captureMainWindowFrame(mainWindow)

    const payload: ScreenshotInitPayload = {
      dataUrl: frame.dataUrl,
      captureWidth: frame.width,
      captureHeight: frame.height,
      displayWidth: frame.displayWidth,
      displayHeight: frame.displayHeight
    }

    return await new Promise<ScreenshotPickResult | null>((resolve) => {
      pendingResolve = resolve
      overlayWindow = createOverlayWindow(bounds)
      const win = overlayWindow

      void waitForOverlayReady(win).then(() => {
        if (win.isDestroyed()) return
        win.show()
        win.focus()
      })

      win.webContents.once('did-finish-load', () => {
        win.webContents.send(IPC.screenshot.init, payload)
      })

      loadOverlayPage(win)
    })
  } finally {
    cleanupOverlay()
    if (wasVisible) {
      mainWindow.show()
    }
    if (wasMinimized) {
      mainWindow.minimize()
    } else if (wasVisible) {
      mainWindow.focus()
    }
  }
}

export function registerScreenshotOverlayHandlers(): void {
  ipcMain.on(IPC.screenshot.ready, () => {
    notifyScreenshotOverlayReady()
  })
}
