import { shell } from 'electron'
import { mkdir, readFile } from 'fs/promises'
import type { AppLogInfo } from '../../shared/appLog'
import type { AuditEntry } from '../../shared/auditLog'
import { resolveAppAuditDir, resolveAppLogsDir } from '../../shared/workspaceLayout'
import { getWorkspaceRoot } from '../config/workspaceRootService'
import { AuditLog } from '../policy/AuditLog'
import { getAppLogDir, getCurrentAppLogFile, initAppFileLogger } from './AppFileLogger'

let sharedAudit: AuditLog | null = null

/** 按当前工作区根目录配置运行日志与审计日志落盘路径 */
export function initLogging(projectRoot: string): void {
  initAppFileLogger(resolveAppLogsDir(projectRoot))
  sharedAudit = new AuditLog(resolveAppAuditDir(projectRoot))
}

function ensureLogging(): void {
  if (!sharedAudit) {
    initLogging(getWorkspaceRoot())
  }
}

export function getSharedAuditLog(): AuditLog {
  ensureLogging()
  return sharedAudit!
}

export function getAppLogInfo(): AppLogInfo {
  const audit = getSharedAuditLog()
  return {
    logDir: getAppLogDir(),
    currentLogFile: getCurrentAppLogFile(),
    auditDir: audit.getAuditDir(),
    currentAuditFile: audit.todayFilePath()
  }
}

export async function readRecentAuditEntries(limit: number): Promise<AuditEntry[]> {
  return getSharedAuditLog().readRecent(limit)
}

export async function readRecentAppLogLines(limit: number): Promise<string[]> {
  ensureLogging()
  const n = Math.max(1, Math.min(Math.floor(limit), 200))
  try {
    const raw = await readFile(getCurrentAppLogFile(), 'utf-8')
    const lines = raw.split('\n').filter((line) => line.trim())
    return lines.slice(Math.max(0, lines.length - n))
  } catch {
    return []
  }
}

export async function openLogsDirectory(which: 'logs' | 'audit'): Promise<boolean> {
  const info = getAppLogInfo()
  const target = which === 'audit' ? info.auditDir : info.logDir
  await mkdir(target, { recursive: true })
  const result = await shell.openPath(target)
  return result === ''
}
