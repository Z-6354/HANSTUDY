import type { BrowserWindow } from 'electron'

/** 强制主窗口 Chromium 页面 zoom 为 100%（标题栏/侧栏等整页 UI） */
export function lockPageZoomForWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  const wc = win.webContents
  if (wc.isDestroyed()) return

  const factor = wc.getZoomFactor()
  if (Math.abs(factor - 1) > 0.001) {
    wc.setZoomFactor(1)
    wc.setZoomLevel(0)
  }

  const wcExt = wc as Electron.WebContents & {
    setZoomMode?: (mode: 'default' | 'isolated' | 'disabled') => void
  }
  try {
    wcExt.setZoomMode?.('disabled')
  } catch {
    // ignore unsupported builds
  }
}
