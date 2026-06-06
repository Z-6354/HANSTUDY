import { BrowserView, BrowserWindow } from 'electron'
import type { Rectangle } from 'electron'
import { join } from 'path'

import type { WebGuestEvent } from '../../shared/webGuest'
import { IPC } from '../../shared/ipc/channels'
import {
  isBlankGuestUrl,
  isWebNavigableUrl,
  normalizeGuestBounds,
  shouldStartGuestNavigation
} from '../../shared/webGuestBounds'

export type { WebGuestEvent }

let hostWindow: BrowserWindow | null = null
const guestViews = new Map<string, BrowserView>()
let activeDocId: string | null = null

function emit(event: WebGuestEvent): void {
  hostWindow?.webContents.send(IPC.webGuest.event, event)
}

function getActiveGuest(): BrowserView | null {
  if (!activeDocId) return null
  return guestViews.get(activeDocId) ?? null
}

function guestNavigation(view: BrowserView): { canGoBack: boolean; canGoForward: boolean } {
  return {
    canGoBack: view.webContents.canGoBack(),
    canGoForward: view.webContents.canGoForward()
  }
}

function startGuestNavigation(view: BrowserView, url: string): boolean {
  if (!url.trim()) return false
  const current = view.webContents.getURL()
  if (!shouldStartGuestNavigation(current, url)) return false
  void view.webContents.loadURL(url)
  return true
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
    emit({
      type: 'did-stop-loading',
      docId,
      url: wc.getURL(),
      ...guestNavigation(view)
    })
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
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false
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
  return normalizeGuestBounds(bounds)
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
  win.on('closed', () => {
    destroyWebGuest()
    hostWindow = null
  })
}

/** 提前创建 BrowserView 并在后台开始加载（减少首屏 attach 等待） */
export function prepareWebGuestDoc(docId: string, url?: string): void {
  const view = getOrCreateGuestView(docId)
  if (url && isBlankGuestUrl(view.webContents.getURL())) {
    startGuestNavigation(view, url)
  }
}

export function attachWebGuest(docId: string, bounds: Rectangle, initialUrl?: string): boolean {
  if (!hostWindow) return false

  if (activeDocId !== docId) {
    hideActiveGuest()
  }

  const view = getOrCreateGuestView(docId)
  activeDocId = docId
  hostWindow.setBrowserView(view)
  view.setBounds(normalizeBounds(bounds))

  if (initialUrl && isBlankGuestUrl(view.webContents.getURL())) {
    return startGuestNavigation(view, initialUrl)
  }
  return false
}

function activateGuestDoc(docId: string): BrowserView | null {
  if (!hostWindow) return null
  const view = guestViews.get(docId)
  if (!view) return null
  if (activeDocId !== docId) {
    hideActiveGuest()
    activeDocId = docId
    hostWindow.setBrowserView(view)
  }
  return view
}

export function navigateWebGuest(docId: string, url: string): boolean {
  const guestView = activateGuestDoc(docId) ?? guestViews.get(docId)
  if (!guestView) return false
  return startGuestNavigation(guestView, url)
}

export function setWebGuestBounds(bounds: Rectangle): void {
  getActiveGuest()?.setBounds(normalizeBounds(bounds))
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
  if (!guestView) {
    return { canGoBack: false, canGoForward: false }
  }
  return guestNavigation(guestView)
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

export function getWebGuestCount(): number {
  return guestViews.size
}

export function selectAllWebGuest(): void {
  void getActiveGuest()?.webContents.executeJavaScript(`
    (function () {
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        active.select()
        return
      }
      const sel = window.getSelection()
      if (!sel) return
      const range = document.createRange()
      range.selectNodeContents(document.body)
      sel.removeAllRanges()
      sel.addRange(range)
    })()
  `)
}

export function findInWebGuest(text: string, forward = true): void {
  const view = getActiveGuest()
  if (!view || !text.trim()) return
  view.webContents.findInPage(text, { forward, findNext: true })
}

export function stopFindInWebGuest(): void {
  getActiveGuest()?.webContents.stopFindInPage('clearSelection')
}

export function openWebGuestDevTools(): void {
  getActiveGuest()?.webContents.openDevTools({ mode: 'detach' })
}

export function isWebGuestAttached(): boolean {
  return getActiveGuest() != null
}

export function getWebGuestState(): {
  url: string
  attached: boolean
  canGoBack: boolean
  canGoForward: boolean
} {
  const guestView = getActiveGuest()
  return {
    url: guestView?.webContents.getURL() ?? '',
    attached: guestView != null,
    canGoBack: guestView?.webContents.canGoBack() ?? false,
    canGoForward: guestView?.webContents.canGoForward() ?? false
  }
}
