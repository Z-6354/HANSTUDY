import { app, BrowserWindow } from 'electron'
import { startApp, shutdownApp } from './bootstrap/AppBootstrap'
import { createMainWindow } from './bootstrap/createWindow'
import { getAppContext } from './bootstrap/AppContext'
import { applyAppEnvironment, shouldEnforceSingleInstance } from './config/appEnvironment'

// 禁止触控板 pinch 触发 Chromium 页面缩放（须在 app.ready 之前）
app.commandLine.appendSwitch('disable-pinch')

applyAppEnvironment()

const gotSingleInstanceLock = shouldEnforceSingleInstance()
  ? app.requestSingleInstanceLock()
  : true
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getAppContext().mainWindow
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

if (gotSingleInstanceLock) {
  let isShuttingDown = false

  app.whenReady().then(() => {
    void startApp().catch((err) => {
      console.error('[bootstrap] startApp failed:', err)
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('before-quit', (event) => {
    if (isShuttingDown) return
    event.preventDefault()
    isShuttingDown = true
    void shutdownApp().finally(() => {
      app.quit()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
