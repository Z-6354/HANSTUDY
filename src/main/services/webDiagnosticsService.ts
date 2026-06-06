import { app } from 'electron'
import type { WebDiagnosticProbeResult, WebDiagnosticReport } from '../../shared/webDiagnostics'

const PROBE_URLS: Record<string, string> = {
  example: 'https://example.com/',
  baidu: 'https://www.baidu.com/'
}

async function probeUrl(url: string): Promise<WebDiagnosticProbeResult> {
  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000)
    })
    return { ok: res.ok, status: res.status, elapsedMs: Date.now() - start }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - start
    }
  }
}

export async function runWebDiagnostics(): Promise<WebDiagnosticReport> {
  const probes: Record<string, WebDiagnosticProbeResult> = {}
  for (const [name, url] of Object.entries(PROBE_URLS)) {
    probes[name] = await probeUrl(url)
  }

  return {
    electron: process.versions.electron ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
    node: process.versions.node ?? 'unknown',
    platform: process.platform,
    webviewTagEnabled: true,
    probes
  }
}

export async function probeWebUrl(url: string): Promise<WebDiagnosticProbeResult> {
  return probeUrl(url)
}

export function logWebDiagnostics(report: WebDiagnosticReport): void {
  console.log('[web-diagnostics]', JSON.stringify(report, null, 2))
  if (app.isPackaged) return
  for (const [name, probe] of Object.entries(report.probes)) {
    console.log(
      `[web-diagnostics] probe ${name}: ${probe.ok ? 'OK' : 'FAIL'} ` +
        `${probe.status ?? ''} ${probe.error ?? ''} (${probe.elapsedMs}ms)`
    )
  }
}
