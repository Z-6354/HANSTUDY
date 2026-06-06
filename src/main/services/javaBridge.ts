import { app } from 'electron'
import { ChildProcess, spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'http://127.0.0.1:17890'
const HEALTH_TIMEOUT_MS = 30_000
const HEALTH_INTERVAL_MS = 300

function decodeJavaOutput(buf: Buffer): string {
  const utf8 = buf.toString('utf8')
  if (!utf8.includes('\uFFFD')) return utf8
  if (process.platform === 'win32') {
    try {
      return new TextDecoder('gbk').decode(buf)
    } catch {
      // ignore
    }
  }
  return utf8
}

let javaProcess: ChildProcess | null = null
let started = false
let useJavaBackend = false
let fallbackReason: string | undefined

export interface BackendStatus {
  jarAvailable: boolean
  javaRunning: boolean
  storageMode: 'java' | 'node'
  fallbackReason?: string
}

function resolveJarPath(): string | null {
  const candidates = [
    join(process.resourcesPath, 'java', 'hanstudy-backend.jar'),
    join(process.cwd(), 'java-backend', 'target', 'hanstudy-backend.jar'),
    join(__dirname, '../../../java-backend/target/hanstudy-backend.jar')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

function resolveBundledJavaBin(): string | null {
  const binName = process.platform === 'win32' ? 'java.exe' : 'java'
  const bundled = join(process.resourcesPath, 'jre', 'bin', binName)
  if (existsSync(bundled)) return bundled
  return null
}

function resolveJavaBin(): string {
  const bundled = resolveBundledJavaBin()
  if (bundled) return bundled
  if (process.env.JAVA_HOME) {
    return join(
      process.env.JAVA_HOME,
      'bin',
      process.platform === 'win32' ? 'java.exe' : 'java'
    )
  }
  return process.platform === 'win32' ? 'java.exe' : 'java'
}

async function probeHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(800) })
    return res.ok
  } catch {
    return false
  }
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await probeHealth()) return
    await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS))
  }
  if (await probeHealth()) {
    throw new Error(
      '端口 17890 已被占用，可能已有 HAN Study Reader 在运行。请关闭其他实例后重试。'
    )
  }
  throw new Error('Java 后端健康检查超时（30s）')
}

/** JAR is present in dev or packaged layout (may not be running yet). */
export function hasJavaBackendJar(): boolean {
  return resolveJarPath() !== null
}

/** Java backend started successfully and should receive annotation traffic. */
export function isJavaBackendEnabled(): boolean {
  if (process.env.USE_JAVA_BACKEND === 'false') return false
  return useJavaBackend
}

export function getBackendStatus(): BackendStatus {
  return {
    jarAvailable: hasJavaBackendJar(),
    javaRunning: useJavaBackend,
    storageMode: useJavaBackend ? 'java' : 'node',
    fallbackReason
  }
}

export function disableJavaBackend(reason: string): void {
  useJavaBackend = false
  fallbackReason = reason
}

export async function startJavaBackend(): Promise<void> {
  if (started) return
  const jarPath = resolveJarPath()
  if (!jarPath) {
    throw new Error('Java backend JAR not found. Run: npm run build:java')
  }

  const javaBin = resolveJavaBin()
  if (app.isPackaged && !resolveBundledJavaBin() && !process.env.JAVA_HOME) {
    throw new Error('安装包内未找到捆绑 JRE，且系统未配置 JAVA_HOME')
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const fail = (err: Error): void => {
      if (settled) return
      settled = true
      reject(err)
    }

    javaProcess = spawn(javaBin, ['-jar', jarPath], {
      env: {
        ...process.env,
        HANSTUDY_USER_DATA: app.getPath('userData'),
        JAVA_TOOL_OPTIONS: [
          process.env.JAVA_TOOL_OPTIONS,
          '-Dfile.encoding=UTF-8',
          '-Dsun.stdout.encoding=UTF-8',
          '-Dsun.stderr.encoding=UTF-8'
        ]
          .filter(Boolean)
          .join(' ')
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })

    javaProcess.once('error', (err) => {
      fail(
        new Error(
          `无法启动 Java 进程（${javaBin}）：${err.message}。` +
            (app.isPackaged ? '请重新安装应用。' : '请安装 Java 11+ 或运行 npm run prepare:jre。')
        )
      )
    })

    javaProcess.stdout?.on('data', (buf: Buffer) => {
      console.log('[java]', decodeJavaOutput(buf).trim())
    })
    javaProcess.stderr?.on('data', (buf: Buffer) => {
      console.error('[java]', decodeJavaOutput(buf).trim())
    })
    javaProcess.on('exit', (code) => {
      console.log('[java] process exited', code)
      javaProcess = null
      started = false
      if (useJavaBackend) {
        disableJavaBackend(`Java 进程意外退出 (code ${code ?? 'unknown'})`)
      }
    })

    void waitForHealth()
      .then(() => {
        if (settled) return
        settled = true
        started = true
        useJavaBackend = true
        fallbackReason = undefined
        resolve()
      })
      .catch(fail)
  })
}

export async function stopJavaBackend(): Promise<void> {
  if (!started) return
  try {
    await fetch(`${BASE_URL}/shutdown`, { method: 'POST' })
  } catch {
    // ignore
  }
  if (javaProcess && !javaProcess.killed) {
    javaProcess.kill()
  }
  javaProcess = null
  started = false
  useJavaBackend = false
}

export async function javaGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Java GET ${path} failed: ${res.status}`)
  }
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return (await res.json()) as T
  }
  return (await res.text()) as T
}

export async function javaPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Java POST ${path} failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export async function javaPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Java PATCH ${path} failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export async function javaDelete(path: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Java DELETE ${path} failed: ${res.status}`)
  }
}
