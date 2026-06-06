import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ExternalLink, Globe, Loader2, Lock, RefreshCw, Star } from 'lucide-react'
import { pushDebugEvent } from '../../../shared/webDiagnostics'
import type { WebGuestBounds, WebGuestEvent } from '../../../shared/webGuest'
import { isRecordableWebUrl } from '../../../shared/webLibrary'
import { resolveWebInput, webDisplayName } from '../../../shared/webCrop'
import { IconButton } from '../components/IconButton'
import { useAppSettingsStore } from '../stores/appSettingsStore'
import { useWebLibraryStore } from '../stores/webLibraryStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { WebViewerDiagnostics } from './WebViewerDiagnostics'

interface WebViewerProps {
  url: string
  docId: string
  isActive: boolean
}

/** 为左右悬浮条预留宽度，避免 BrowserView 盖住按钮 */
const LAYOUT_RAIL_GUTTER = 44

function logWeb(event: string, detail?: unknown): void {
  if (import.meta.env.DEV) {
    console.log(`[WebViewer] ${event}`, detail ?? '')
  }
}

function readBounds(
  frame: HTMLElement,
  rails: { left: boolean; right: boolean }
): WebGuestBounds {
  const rect = frame.getBoundingClientRect()
  let x = rect.left
  let width = Math.max(Math.floor(rect.width), 64)
  if (rails.left) {
    x += LAYOUT_RAIL_GUTTER
    width = Math.max(width - LAYOUT_RAIL_GUTTER, 64)
  }
  if (rails.right) {
    width = Math.max(width - LAYOUT_RAIL_GUTTER, 64)
  }
  return {
    x,
    y: rect.top,
    width,
    height: Math.max(Math.floor(rect.height), 64)
  }
}

/** 导航去重：忽略末尾斜杠差异 */
function urlsEquivalent(a: string, b: string): boolean {
  if (a === b) return true
  try {
    const ua = new URL(a)
    const ub = new URL(b)
    return ua.href === ub.href
  } catch {
    return false
  }
}

function isBlankGuestUrl(url: string): boolean {
  return !url || url === 'about:blank'
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

  const { updateWebSession, setWebSession, webNavAction, webNavSeq } = useWorkspaceStore()
  const showSidebar = useWorkspaceStore((s) => s.showSidebar)
  const showAIPanel = useWorkspaceStore((s) => s.showAIPanel)
  const searchEngine = useAppSettingsStore((s) => s.searchEngine)
  const { addHistory, addBookmark, removeBookmark, bookmarks, isBookmarked } = useWebLibraryStore()

  const railGutter = { left: !showSidebar, right: !showAIPanel }

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
      if (lastRecordedUrlRef.current === visitUrl) return
      lastRecordedUrlRef.current = visitUrl
      void addHistory(visitUrl, visitTitle)
      void isBookmarked(visitUrl).then(setBookmarked)
    },
    [addHistory, isBookmarked]
  )

  isActiveRef.current = isActive

  const syncBounds = useCallback(async (): Promise<WebGuestBounds | null> => {
    const bounds = measureGuestBounds()
    if (!bounds) return null
    setFrameSize({ width: bounds.width, height: bounds.height })
    if (attachedRef.current) {
      await window.api.webGuest.setBounds(bounds)
    }
    return bounds
  }, [measureGuestBounds])

  const loadGuestUrl = useCallback(
    async (reason: string, href?: string, force = false): Promise<void> => {
      const target = href ?? pendingUrlRef.current
      if (!target) return
      if (!attachedRef.current || !isActiveRef.current) {
        pushEvent(`defer load（未附着）: ${reason}`)
        return
      }

      if (!force && urlsEquivalent(target, lastLoadedUrlRef.current)) {
        pushEvent(`skip load（相同 URL）: ${reason}`)
        return
      }

      const state = await window.api.webGuest.getState()
      if (!attachedRef.current || !isActiveRef.current) return
      if (!force && urlsEquivalent(target, state.url)) {
        lastLoadedUrlRef.current = target
        setGuestUrl(state.url)
        setLoading(false)
        pushEvent(`skip load（guest 已在目标页）: ${reason}`)
        return
      }

      setLoadError(null)
      setLoading(true)
      pushEvent(`navigate (${reason}): ${target}`)
      const result = await window.api.webGuest.navigate(docId, target)
      if (!attachedRef.current || !isActiveRef.current) return
      if (result.started) {
        lastLoadedUrlRef.current = target
      }
      setGuestUrl(result.url)
    },
    [docId, pushEvent]
  )

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

    const attach = async (): Promise<void> => {
      if (attachStartedRef.current) return
      attachStartedRef.current = true
      const bounds = measureGuestBounds()
      if (!bounds || cancelled) return
      setFrameSize({ width: bounds.width, height: bounds.height })
      const state = await window.api.webGuest.attach(docId, bounds)
      if (cancelled) {
        attachStartedRef.current = false
        void window.api.webGuest.detach()
        return
      }
      attachedRef.current = true
      setGuestReady(true)
      setCanGoBack(state.canGoBack)
      setCanGoForward(state.canGoForward)
      setGuestUrl(state.url)

      const startUrl = pendingUrlRef.current
      if (!isBlankGuestUrl(state.url)) {
        lastLoadedUrlRef.current = state.url
        setCurrentUrl(state.url)
        setDraft(state.url)
        setLoading(false)
        pushEvent(`reattach（保留页面）: ${state.url}`)
        return
      }

      await loadGuestUrl('initial', startUrl, true)
    }

    void attach()

    return () => {
      cancelled = true
      attachStartedRef.current = false
      if (attachedRef.current) {
        attachedRef.current = false
        setGuestReady(false)
      }
      void window.api.webGuest.detach()
    }
  }, [isActive, docId, loadGuestUrl, pushEvent])

  useEffect(() => {
    return () => {
      void window.api.webGuest.destroyDoc(docId)
      if (useWorkspaceStore.getState().webSession?.docId === docId) {
        setWebSession(null)
      }
    }
  }, [docId, setWebSession])

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
    })
    ro.observe(frame)
    window.addEventListener('resize', syncBounds)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', syncBounds)
    }
  }, [syncBounds, measureGuestBounds])

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
          pushSession({ loading: false, currentUrl: event.url })
          pushEvent(`did-stop-loading: ${event.url}`)
          recordVisit(event.url, titleRef.current || event.url)
          void window.api.webGuest.getState().then((state) => {
            if (!isActiveRef.current) return
            setCanGoBack(state.canGoBack)
            setCanGoForward(state.canGoForward)
          })
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
          attachedRef.current = false
          setGuestReady(false)
          void window.api.webGuest.detach()
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
    void (async () => {
      const bounds = measureGuestBounds()
      if (!bounds) return
      await window.api.webGuest.attach(docId, bounds)
      attachedRef.current = true
      setGuestReady(true)
      await loadGuestUrl('retry', pendingUrlRef.current, true)
    })()
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
