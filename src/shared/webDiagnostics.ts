/** 内置测试页：用于区分「webview 坏了」还是「外网/ DNS 问题」 */
export const WEB_TEST_PAGES = {
  /** 纯 data URL，不依赖网络 */
  inline: 'data:text/html;charset=utf-8,' + encodeURIComponent(
    '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px">' +
      '<h1>✅ WebView 内联测试成功</h1>' +
      '<p>若能看到此页，说明 &lt;webview&gt; 可渲染，问题可能在外网或目标站点。</p>' +
      '</body></html>'
  ),
  example: 'https://example.com/',
  baidu: 'https://www.baidu.com/',
  bing: 'https://www.bing.com/'
} as const

export type WebTestPageId = keyof typeof WEB_TEST_PAGES

export interface WebDiagnosticProbeResult {
  ok: boolean
  status?: number
  error?: string
  elapsedMs: number
}

export interface WebDiagnosticReport {
  electron: string
  chrome: string
  node: string
  platform: string
  webviewTagEnabled: boolean
  probes: Record<string, WebDiagnosticProbeResult>
}

export interface WebViewerDebugState {
  frameWidth: number
  frameHeight: number
  guestWidth: number
  guestHeight: number
  webviewReady: boolean
  guestAttached: boolean
  loading: boolean
  guestUrl: string
  targetUrl: string
  lastEvents: string[]
}

export function pushDebugEvent(events: string[], message: string, max = 12): string[] {
  const line = `${new Date().toLocaleTimeString()} ${message}`
  return [line, ...events].slice(0, max)
}
