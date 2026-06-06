import { BrowserView, BrowserWindow } from 'electron'
import type { Rectangle } from 'electron'
import { join } from 'path'

import type { WebGuestEvent } from '../../shared/webGuest'

export type { WebGuestEvent }

let hostWindow: BrowserWindow | null = null
const guestViews = new Map<string, BrowserView>()
let activeDocId: string | null = null

function emit(event: WebGuestEvent): void {
  hostWindow?.webContents.send('webGuest:event', event)
}

function getActiveGuest(): BrowserView | null {
  if (!activeDocId) return null
  return guestViews.get(activeDocId) ?? null
}

function isWebNavigableUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function bindGuestEvents(view: BrowserView, docId: string): void {
  const wc = view.webContents

  wc.on('dom-ready', () => {
    emit({ type: 'dom-ready', docId })
  })
  wc.on('did-start-loading', () => {
    emit({ type: 'did-start-loading', docId })
  })
  wc.on('did-stop-loading', () => {
    emit({ type: 'did-stop-loading', docId, url: wc.getURL() })
  })
  wc.on('did-navigate', (_e, url) => {
    emit({ type: 'did-navigate', docId, url })
  })
  wc.on('did-navigate-in-page', (_e, url) => {
    emit({ type: 'did-navigate', docId, url })
  })
  wc.on('page-title-updated', (_e, title) => {
    emit({ type: 'page-title-updated', docId, title, url: wc.getURL() })
  })
  wc.on('did-fail-load', (_e, errorCode, errorDescription, _validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return
    emit({
      type: 'did-fail-load',
      docId,
      errorCode,
      errorDescription,
      url: wc.getURL()
    })
  })
  // target=_blank / window.open → 在当前 BrowserView 内打开，不弹出系统浏览器
  wc.setWindowOpenHandler(({ url }) => {
    if (isWebNavigableUrl(url)) {
      void wc.loadURL(url)
    }
    return { action: 'deny' }
  })
}

function createGuestView(docId: string): BrowserView {
  const view = new BrowserView({
    webPreferences: {
      partition: 'persist:hanstudy-web',
      preload: join(__dirname, '../preload/webGuest.js'),
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
      webgl: true,
      sandbox: false
    }
  })
  bindGuestEvents(view, docId)
  return view
}

function getOrCreateGuestView(docId: string): BrowserView {
  let view = guestViews.get(docId)
  if (!view) {
    view = createGuestView(docId)
    guestViews.set(docId, view)
  }
  return view
}

function normalizeBounds(bounds: Rectangle): Rectangle {
  return {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(64, Math.round(bounds.width)),
    height: Math.max(64, Math.round(bounds.height))
  }
}

function hideActiveGuest(): void {
  if (!hostWindow || !activeDocId) return
  const view = guestViews.get(activeDocId)
  if (view) {
    hostWindow.removeBrowserView(view)
  }
}

export function initWebGuestService(win: BrowserWindow): void {
  hostWindow = win
  win.on('resize', () => {
    // bounds updated from renderer ResizeObserver
  })
  win.on('closed', () => {
    destroyWebGuest()
    hostWindow = null
  })
}

export function attachWebGuest(docId: string, bounds: Rectangle): void {
  if (!hostWindow) return

  if (activeDocId !== docId) {
    hideActiveGuest()
  }

  const view = getOrCreateGuestView(docId)
  activeDocId = docId
  hostWindow.setBrowserView(view)
  view.setBounds(normalizeBounds(bounds))
}

export function setWebGuestBounds(bounds: Rectangle): void {
  getActiveGuest()?.setBounds(normalizeBounds(bounds))
}

export function navigateWebGuest(docId: string, url: string): boolean {
  const guestView = guestViews.get(docId)
  if (!guestView || !url.trim()) return false
  let current = guestView.webContents.getURL()
  try {
    current = new URL(current).href
    const target = new URL(url).href
    if (current === target) return false
  } catch {
    if (current === url) return false
  }
  void guestView.webContents.loadURL(url)
  return true
}

export function webGuestGoBack(): boolean {
  const guestView = getActiveGuest()
  if (!guestView?.webContents.canGoBack()) return false
  guestView.webContents.goBack()
  return true
}

export function webGuestGoForward(): boolean {
  const guestView = getActiveGuest()
  if (!guestView?.webContents.canGoForward()) return false
  guestView.webContents.goForward()
  return true
}

export function reloadWebGuest(): void {
  getActiveGuest()?.webContents.reload()
}

export function getWebGuestUrl(): string {
  return getActiveGuest()?.webContents.getURL() ?? ''
}

export function getWebGuestNavigation(): { canGoBack: boolean; canGoForward: boolean } {
  const guestView = getActiveGuest()
  return {
    canGoBack: guestView?.webContents.canGoBack() ?? false,
    canGoForward: guestView?.webContents.canGoForward() ?? false
  }
}

export function detachWebGuest(): void {
  hideActiveGuest()
  activeDocId = null
}

export function destroyWebGuestDoc(docId: string): void {
  const view = guestViews.get(docId)
  if (!view) return

  if (activeDocId === docId) {
    hideActiveGuest()
    activeDocId = null
  }

  view.webContents.close()
  guestViews.delete(docId)
}

export function destroyWebGuest(): void {
  for (const docId of Array.from(guestViews.keys())) {
    destroyWebGuestDoc(docId)
  }
}

export function openWebGuestDevTools(): void {
  getActiveGuest()?.webContents.openDevTools({ mode: 'detach' })
}

export function isWebGuestAttached(): boolean {
  return getActiveGuest() != null
}
