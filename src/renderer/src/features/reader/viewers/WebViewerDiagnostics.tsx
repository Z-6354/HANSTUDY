import { useState } from 'react'
import { Bug, ChevronDown, ChevronUp } from 'lucide-react'
import type { WebDiagnosticReport, WebViewerDebugState } from '@shared/webDiagnostics'
import { WEB_TEST_PAGES, type WebTestPageId } from '@shared/webDiagnostics'
interface WebViewerDiagnosticsProps {
  debug: WebViewerDebugState
  onLoadTest: (url: string, label: string) => void
  onOpenDevTools: () => void
}

export function WebViewerDiagnostics({
  debug,
  onLoadTest,
  onOpenDevTools
}: WebViewerDiagnosticsProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [report, setReport] = useState<WebDiagnosticReport | null>(null)
  const [probing, setProbing] = useState(false)

  const runMainDiagnostics = async (): Promise<void> => {
    setProbing(true)
    try {
      const r = await window.api.web.runDiagnostics()
      setReport(r)
      console.log('[WebViewer] main diagnostics', r)
    } finally {
      setProbing(false)
    }
  }

  const probeCurrent = async (): Promise<void> => {
    setProbing(true)
    try {
      const r = await window.api.web.probeUrl(debug.targetUrl)
      console.log('[WebViewer] probe', debug.targetUrl, r)
      setReport((prev) =>
        prev
          ? { ...prev, probes: { ...prev.probes, current: r } }
          : {
              electron: '?',
              chrome: '?',
              node: '?',
              platform: '?',
              webviewTagEnabled: true,
              probes: { current: r }
            }
      )
    } finally {
      setProbing(false)
    }
  }

  return (
    <div className="web-diagnostics">
      <button
        type="button"
        className="web-diagnostics-toggle"
        onClick={() => setOpen((v: boolean) => !v)}
      >
        <Bug size={12} />
        <span>网页诊断</span>
        {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      {open && (
        <div className="web-diagnostics-body">
          <div className="web-diagnostics-grid">
            <span>容器</span>
            <code>
              {debug.frameWidth}×{debug.frameHeight}px
            </code>
            <span>webview</span>
            <code>
              {debug.guestWidth}×{debug.guestHeight}px
            </code>
            <span>ready</span>
            <code>{String(debug.webviewReady)}</code>
            <span>loading</span>
            <code>{String(debug.loading)}</code>
            <span>guest URL</span>
            <code className="web-diagnostics-url">{debug.guestUrl || '(�?'}</code>
            <span>目标 URL</span>
            <code className="web-diagnostics-url">{debug.targetUrl}</code>
          </div>

          <div className="web-diagnostics-actions">
            {(Object.keys(WEB_TEST_PAGES) as WebTestPageId[]).map((id) => (
              <button
                key={id}
                type="button"
                className="web-diagnostics-btn"
                onClick={() => onLoadTest(WEB_TEST_PAGES[id], id)}
              >
                测试: {id}
              </button>
            ))}
            <button
              type="button"
              className="web-diagnostics-btn"
              disabled={probing}
              onClick={() => void runMainDiagnostics()}
            >
              主进程网络探�?
            </button>
            <button
              type="button"
              className="web-diagnostics-btn"
              disabled={probing}
              onClick={() => void probeCurrent()}
            >
              探测当前 URL
            </button>
            <button type="button" className="web-diagnostics-btn" onClick={onOpenDevTools}>
              WebView DevTools
            </button>
          </div>

          {report && (
            <pre className="web-diagnostics-log">
              {JSON.stringify(report, null, 2)}
            </pre>
          )}

          {debug.lastEvents.length > 0 && (
            <div className="web-diagnostics-events">
              <strong>事件</strong>
              <ul>
                {debug.lastEvents.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="web-diagnostics-hint">
            使用 BrowserView 渲染（非 webview 标签）。先点「测�? inline」：若仍白屏，点 WebView DevTools 查看 guest 控制台�?
          </p>
        </div>
      )}
    </div>
  )
}
