import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ExternalLink, Globe, Loader2, Lock, RefreshCw, Star, ZoomIn, ZoomOut } from 'lucide-react'
import { pushDebugEvent } from '@shared/webDiagnostics'
import type { WebGuestBounds, WebGuestEvent } from '@shared/webGuest'
import { isRecordableWebUrl } from '@shared/webLibrary'
import { resolveWebInput, webDisplayName } from '@shared/webCrop'
import { isUsableWebPageTitle, webDisplayTitle } from '@shared/webLibrary'
import { IconButton } from '../../../components/IconButton'
import { useAppSettingsStore } from '../../../stores/appSettingsStore'
import { useWebLibraryStore } from '../../../stores/webLibraryStore'
import { useViewerCommand } from '../../../features/reader/find/useViewerCommand'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { WebViewerDiagnostics } from './WebViewerDiagnostics'
import { useWebZoom } from './useWebZoom'
import {
  guestUrlsEquivalent,
  isBlankGuestUrl,
  readWebGuestBounds
} from '@shared/webGuestBounds'

interface WebViewerProps {
  url: string
  docId: string
  isActive: boolean
}

function logWeb(event: string, detail?: unknown): void {
  if (import.meta.env.DEV) {
    console.log(`[WebViewer] ${event}`, detail ?? '')
  }
}

function readBounds(
  frame: HTMLElement,
  rails: { left: boolean; right: boolean }
): import('@shared/webGuestBounds').WebGuestBounds {
  return readWebGuestBounds(frame.getBoundingClientRect(), rails)
}

export function WebViewer({ url, docId, isActive }: WebViewerProps): JSX.Element {
  const frameRef = useRef<HTMLDivElement>(null)
  const pendingUrlRef = useRef('')
  const lastLoadedUrlRef = useRef('')
  const attachedRef = useRef(false)
  const attachStartedRef = useRef(false)
  const isActiveRef = useRef(isActive)
  const lastRecordedUrlRef = useRef('')
  const titleRef = useRef('')

  const [currentUrl, setCurrentUrl] = useState(url)
  const [draft, setDraft] = useState(url)
  const [draftFocused, setDraftFocused] = useState(false)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [guestReady, setGuestReady] = useState(false)
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 })
  const [guestUrl, setGuestUrl] = useState('')
  const [lastEvents, setLastEvents] = useState<string[]>([])
  const [bookmarked, setBookmarked] = useState(false)

  const { updateWebSession, clearWebSession, webNavAction, webNavSeq, findBarOpen, findQuery, findStepSeq, findStepForward } =
    useWorkspaceStore()
  const showSidebar = useWorkspaceStore((s) => s.showSidebar)
  const showAIPanel = useWorkspaceStore((s) => s.showAIPanel)
  const focusMode = useWorkspaceStore((s) => s.focusMode)
  const searchEngine = useAppSettingsStore((s) => s.searchEngine)
  const { addHistory, addBookmark, removeBookmark, bookmarks, isBookmarked } = useWebLibraryStore()

  const { zoom, zoomIn, zoomOut, resetZoom } = useWebZoom(docId, currentUrl, isActive, guestReady)

  const railGutter = {
    left: !showSidebar && !focusMode,
    right: !showAIPanel && !focusMode
  }

  const measureGuestBounds = useCallback((): WebGuestBounds | null => {
    const frame = frameRef.current
    if (!frame) return null
    return readBounds(frame, railGutter)
  }, [railGutter.left, railGutter.right])

  pendingUrlRef.current = resolveWebInput(currentUrl, searchEngine) ?? currentUrl

  const pushEvent = useCallback((message: string) => {
    setLastEvents((prev) => pushDebugEvent(prev, message))
    logWeb(message)
  }, [])

  const pushSession = useCallback(
    (patch: Partial<{
      currentUrl: string
      title: string
      loading: boolean
      canGoBack: boolean
      canGoForward: boolean
    }>): void => {
      updateWebSession(docId, patch)
    },
    [docId, updateWebSession]
  )

  const recordVisit = useCallback(
    (visitUrl: string, visitTitle: string): void => {
      if (!isRecordableWebUrl(visitUrl)) return
      if (!isUsableWebPageTitle(visitTitle, visitUrl)) return
      if (lastRecordedUrlRef.current === visitUrl) return
      lastRecordedUrlRef.current = visitUrl
      void addHistory(visitUrl, visitTitle)
      void isBookmarked(visitUrl).then(setBookmarked)
    },
    [addHistory, isBookmarked]
  )

  isActiveRef.current = isActive

  useViewerCommand(isActive, 'selectAll', () => {
    void window.api.webGuest.selectAll()
  })

  useEffect(() => {
    if (!isActive || !findBarOpen) {
      void window.api.webGuest.stopFindInPage()
      return
    }
    if (!findQuery.trim()) {
      void window.api.webGuest.stopFindInPage()
      return
    }
    void window.api.webGuest.findInPage(findQuery, findStepForward)
  }, [findBarOpen, findQuery, findStepForward, findStepSeq, isActive])

  const syncBoundsRafRef = useRef<number | null>(null)

  const syncBounds = useCallback((): void => {
    if (syncBoundsRafRef.current != null) {
      cancelAnimationFrame(syncBoundsRafRef.current)
    }
    syncBoundsRafRef.current = requestAnimationFrame(() => {
      syncBoundsRafRef.current = null
      const bounds = measureGuestBounds()
      if (!bounds) return
      setFrameSize({ width: bounds.width, height: bounds.height })
      if (attachedRef.current) {
        void window.api.webGuest.setBounds(bounds)
      }
    })
  }, [measureGuestBounds])

  const loadGuestUrl = useCallback(
    async (reason: string, href?: string, force = false): Promise<void> => {
      const target = href ?? pendingUrlRef.current
      if (!target) return
      if (!attachedRef.current || !isActiveRef.current) {
        pushEvent(`defer load（未附着）: ${reason}`)
        return
      }

      if (!force && guestUrlsEquivalent(target, lastLoadedUrlRef.current)) {
        pushEvent(`skip load（相同 URL）: ${reason}`)
        return
      }

      setLoadError(null)
      setLoading(true)
      pushEvent(`navigate (${reason}): ${target}`)
      const result = await window.api.webGuest.navigate(docId, target)
      if (!attachedRef.current || !isActiveRef.current) return
      if (result.started) {
        lastLoadedUrlRef.current = target
      } else {
        pushEvent(`navigate 未启动（可能 URL 相同）: ${target}`)
        setLoading(false)
      }
      setGuestUrl(result.url)
    },
    [docId, pushEvent]
  )

  const loadGuestUrlRef = useRef(loadGuestUrl)
  loadGuestUrlRef.current = loadGuestUrl

  const runAttach = useCallback(async (): Promise<void> => {
    if (!isActiveRef.current || attachStartedRef.current) return

    const bounds = measureGuestBounds()
    if (!bounds) return

    attachStartedRef.current = true
    try {
      setFrameSize({ width: bounds.width, height: bounds.height })
      const startUrl = pendingUrlRef.current
      const state = await window.api.webGuest.attach(docId, bounds, startUrl)
      if (!isActiveRef.current) {
        void window.api.webGuest.detach()
        return
      }

      attachedRef.current = true
      setGuestReady(true)
      setCanGoBack(state.canGoBack)
      setCanGoForward(state.canGoForward)
      setGuestUrl(state.url)

      if (!isBlankGuestUrl(state.url) && guestUrlsEquivalent(state.url, startUrl)) {
        lastLoadedUrlRef.current = state.url
        setCurrentUrl(state.url)
        setDraft(state.url)
        setLoading(false)
        pushEvent(`reattach（保留页面）: ${state.url}`)
        return
      }

      if (state.started) {
        lastLoadedUrlRef.current = startUrl
        pushEvent(`attach+navigate: ${startUrl}`)
        return
      }

      if (startUrl && isBlankGuestUrl(state.url)) {
        await loadGuestUrlRef.current('initial', startUrl, true)
      } else {
        setLoading(false)
      }
    } catch (err) {
      attachStartedRef.current = false
      attachedRef.current = false
      setGuestReady(false)
      setLoadError(err instanceof Error ? err.message : 'BrowserView 初始化失败')
      setLoading(false)
      pushEvent(`attach 失败: ${String(err)}`)
    }
  }, [docId, measureGuestBounds, pushEvent])

  const navigateGuest = useCallback(
    (href: string, reason: string, force = true): void => {
      const next = resolveWebInput(href, searchEngine) ?? href
      if (!next) return
      pendingUrlRef.current = next
      setCurrentUrl(next)
      void loadGuestUrl(reason, next, force)
    },
    [loadGuestUrl, searchEngine]
  )

  useEffect(() => {
    titleRef.current = title
  }, [title])

  useEffect(() => {
    if (!isUsableWebPageTitle(title, currentUrl)) return
    const display = webDisplayTitle(title, currentUrl)
    const doc = useWorkspaceStore.getState().documents.find((d) => d.id === docId)
    if (doc?.type === 'web' && doc.name !== display) {
      useWorkspaceStore.getState().renameDocument(docId, display)
    }
  }, [title, currentUrl, docId])

  useEffect(() => {
    const startUrl = resolveWebInput(url, searchEngine) ?? url
    pendingUrlRef.current = startUrl
    lastLoadedUrlRef.current = ''
    attachStartedRef.current = false
    setCurrentUrl(startUrl)
    setDraft(startUrl)
    setLoadError(null)
    setLoading(true)
    setGuestReady(false)
    setLastEvents([])
    lastRecordedUrlRef.current = ''
    logWeb(`标签打开 url=${startUrl}`)
    void window.api.webGuest.prepareDoc(docId, startUrl)
    updateWebSession(docId, {
      currentUrl: startUrl,
      title: '',
      loading: true,
      canGoBack: false,
      canGoForward: false
    })
  }, [docId, url, searchEngine, updateWebSession])

  useEffect(() => {
    if (!isActive) {
      if (attachedRef.current) {
        attachedRef.current = false
        attachStartedRef.current = false
        setGuestReady(false)
        void window.api.webGuest.detach()
      }
      return
    }

    let cancelled = false

    const tryAttach = (): void => {
      if (cancelled || attachStartedRef.current || attachedRef.current) return
      void runAttach()
    }

    tryAttach()
    const raf = requestAnimationFrame(() => {
      if (!cancelled && !attachedRef.current) tryAttach()
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      attachStartedRef.current = false
      if (attachedRef.current) {
        attachedRef.current = false
        setGuestReady(false)
      }
      void window.api.webGuest.detach()
    }
  }, [isActive, docId, runAttach])

  useEffect(() => {
    return () => {
      void window.api.webGuest.destroyDoc(docId)
      useWorkspaceStore.getState().clearWebSession(docId)
    }
  }, [docId])

  useEffect(() => {
    if (!draftFocused) {
      setDraft(currentUrl)
    }
  }, [currentUrl, draftFocused])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    void syncBounds()
    const ro = new ResizeObserver(() => {
      void syncBounds()
      if (isActiveRef.current && !attachedRef.current && !attachStartedRef.current) {
        void runAttach()
      }
    })
    ro.observe(frame)
    window.addEventListener('resize', syncBounds)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', syncBounds)
      if (syncBoundsRafRef.current != null) {
        cancelAnimationFrame(syncBoundsRafRef.current)
        syncBoundsRafRef.current = null
      }
    }
  }, [syncBounds, runAttach])

  useEffect(() => {
    if (attachedRef.current) {
      void syncBounds()
    }
  }, [showSidebar, showAIPanel, syncBounds])

  useEffect(() => {
    const handleGuestEvent = (event: WebGuestEvent): void => {
      if (event.docId !== docId) return

      switch (event.type) {
        case 'dom-ready':
          setLoading(false)
          pushEvent('dom-ready')
          break
        case 'did-start-loading':
          setLoading(true)
          pushSession({ loading: true })
          pushEvent('did-start-loading')
          break
        case 'did-stop-loading':
          setLoading(false)
          setGuestUrl(event.url)
          lastLoadedUrlRef.current = event.url
          setCanGoBack(event.canGoBack)
          setCanGoForward(event.canGoForward)
          pushSession({ loading: false, currentUrl: event.url })
          pushEvent(`did-stop-loading: ${event.url}`)
          recordVisit(event.url, titleRef.current || event.url)
          break
        case 'did-navigate':
          lastRecordedUrlRef.current = ''
          setCurrentUrl(event.url)
          pendingUrlRef.current = event.url
          setGuestUrl(event.url)
          pushSession({ currentUrl: event.url })
          pushEvent(`did-navigate: ${event.url}`)
          break
        case 'page-title-updated':
          setTitle(event.title)
          pushSession({ title: event.title })
          pushEvent(`title: ${event.title}`)
          recordVisit(event.url, event.title)
          break
        case 'did-fail-load':
          if (event.errorCode === -3) return
          setLoadError(
            `无法打开此页面：${event.errorDescription?.trim() || `错误码 ${event.errorCode}`}`
          )
          setLoading(false)
          pushSession({ loading: false })
          pushEvent(`did-fail-load: ${event.errorDescription}`)
          break
        default:
          break
      }
    }

    const unsubscribe = window.api.webGuest.onEvent(handleGuestEvent)
    return unsubscribe
  }, [docId, pushEvent, pushSession, recordVisit])

  useEffect(() => {
    if (!isRecordableWebUrl(currentUrl)) {
      setBookmarked(false)
      return
    }
    void isBookmarked(currentUrl).then(setBookmarked)
  }, [currentUrl, isBookmarked, bookmarks.length])

  useEffect(() => {
    if (!isActive || !webNavAction) return
    switch (webNavAction.action) {
      case 'back':
        void window.api.webGuest.back()
        break
      case 'forward':
        void window.api.webGuest.forward()
        break
      case 'reload':
        lastLoadedUrlRef.current = ''
        void window.api.webGuest.reload()
        break
      case 'navigate': {
        const next = resolveWebInput(webNavAction.url ?? '', searchEngine)
        if (next) navigateGuest(next, 'store-nav')
        break
      }
    }
    useWorkspaceStore.getState().clearWebNavAction()
  }, [isActive, webNavSeq, webNavAction, navigateGuest, searchEngine])

  const toggleBookmark = async (): Promise<void> => {
    if (!isRecordableWebUrl(currentUrl)) return
    if (bookmarked) {
      const item = bookmarks.find((b) => b.url === currentUrl)
      if (item) await removeBookmark(item.id)
      setBookmarked(false)
    } else {
      await addBookmark(currentUrl, title || currentUrl)
      setBookmarked(true)
    }
  }

  const navigateToDraft = (): void => {
    const next = resolveWebInput(draft, searchEngine)
    if (!next) return
    navigateGuest(next, 'address-bar')
    setDraftFocused(false)
  }

  const retryLoad = (): void => {
    setLoadError(null)
    lastLoadedUrlRef.current = ''
    attachStartedRef.current = false
    void runAttach().then(() => {
      if (attachedRef.current) {
        void loadGuestUrl('retry', pendingUrlRef.current, true)
      }
    })
  }

  const isSecure = draft.trim().startsWith('https://')
  const targetUrl = pendingUrlRef.current

  return (
    <div className="web-viewer">
      <div className="web-tab-chrome">
        <div className="web-tab-chrome-nav">
          <IconButton
            icon={ArrowLeft}
            label="后退"
            size={14}
            disabled={!canGoBack}
            onClick={() => void window.api.webGuest.back()}
          />
          <IconButton
            icon={ArrowRight}
            label="前进"
            size={14}
            disabled={!canGoForward}
            onClick={() => void window.api.webGuest.forward()}
          />
          <IconButton
            icon={loading ? Loader2 : RefreshCw}
            label="刷新"
            size={14}
            className={loading ? 'spinning' : ''}
            onClick={() => {
              lastLoadedUrlRef.current = ''
              void window.api.webGuest.reload()
            }}
          />
        </div>

        <div className="web-tab-chrome-zoom">
          <IconButton icon={ZoomOut} label="缩小网页" size={14} onClick={zoomOut} />
          <button
            type="button"
            className="web-tab-chrome-zoom-label"
            title="重置为 100%"
            onClick={resetZoom}
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconButton icon={ZoomIn} label="放大网页" size={14} onClick={zoomIn} />
        </div>

        <form
          className="web-tab-chrome-form"
          onSubmit={(e) => {
            e.preventDefault()
            navigateToDraft()
          }}
        >
          <span className="web-tab-chrome-icon" aria-hidden>
            {isSecure ? <Lock size={12} /> : <Globe size={12} />}
          </span>
          <input
            className="web-tab-chrome-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => {
              setDraftFocused(true)
              if (e.currentTarget.value.length > 0) {
                e.currentTarget.select()
              }
            }}
            onBlur={() => setDraftFocused(false)}
            placeholder="输入网址或搜索关键词"
            spellCheck={false}
            aria-label="网页地址"
          />
          {title && !draftFocused && (
            <span className="web-tab-chrome-title" title={title}>
              {title}
            </span>
          )}
        </form>

        <IconButton
          icon={Star}
          label={bookmarked ? '取消收藏' : '收藏此页'}
          size={14}
          className={bookmarked ? 'web-bookmark-btn active' : 'web-bookmark-btn'}
          active={bookmarked}
          onClick={() => void toggleBookmark()}
        />
        <IconButton
          icon={ExternalLink}
          label="在浏览器中打开"
          size={14}
          onClick={() => void window.api.web.openExternal(currentUrl)}
        />
      </div>

      <div className="web-frame web-frame-guest-host" ref={frameRef}>
        {loadError && (
          <div className="web-error-state">
            <p className="web-error-title">{loadError}</p>
            <p className="web-error-url">{currentUrl}</p>
            <div className="web-error-actions">
              <button type="button" className="web-error-btn" onClick={retryLoad}>
                重试
              </button>
              <button
                type="button"
                className="web-error-btn secondary"
                onClick={() => void window.api.web.openExternal(currentUrl)}
              >
                系统浏览器打开
              </button>
            </div>
          </div>
        )}

        {loading && !loadError && (
          <div className="web-loading-overlay">
            <Loader2 size={22} className="spinning" />
            <span>正在加载 {webDisplayName(targetUrl)}…</span>
          </div>
        )}

        {!guestReady && !loadError && (
          <div className="web-guest-placeholder">
            <span>BrowserView 初始化中…</span>
          </div>
        )}
      </div>

      <WebViewerDiagnostics
        debug={{
          frameWidth: frameSize.width,
          frameHeight: frameSize.height,
          guestWidth: frameSize.width,
          guestHeight: frameSize.height,
          webviewReady: guestReady,
          guestAttached: guestReady,
          loading,
          guestUrl,
          targetUrl,
          lastEvents
        }}
        onLoadTest={(testUrl, label) => navigateGuest(testUrl, `test-${label}`)}
        onOpenDevTools={() => {
          void window.api.webGuest.openDevTools()
          pushEvent('openDevTools')
        }}
      />
    </div>
  )
}
