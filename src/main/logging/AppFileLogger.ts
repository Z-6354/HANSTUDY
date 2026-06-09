import { appendFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { localLogDayStamp } from '../../shared/logDayStamp'

type LogLevel = 'INFO' | 'WARN' | 'ERROR'

let logDir: string | null = null
let writeChain = Promise.resolve()

/** 初始化应用运行日志目录（项目根 logs/） */
export function initAppFileLogger(dir: string): void {
  logDir = dir
  void mkdir(logDir, { recursive: true })
}

export function getAppLogDir(): string {
  if (!logDir) {
    throw new Error('App file logger not initialized')
  }
  return logDir
}

export function getCurrentAppLogFile(): string {
  return join(getAppLogDir(), `HANSTUDY-${localLogDayStamp()}.log`)
}

function writeLine(level: LogLevel, scope: string, message: string): void {
  const line = `${formatTimestamp()} [${level}] ${scope} - ${message}\n`
  if (level === 'ERROR') console.error(`[${scope}]`, message)
  else if (level === 'WARN') console.warn(`[${scope}]`, message)
  else console.log(`[${scope}]`, message)

  if (!logDir) return
  const file = getCurrentAppLogFile()
  writeChain = writeChain
    .then(() => appendFile(file, line, 'utf-8'))
    .catch((err) => {
      console.error('[logger] 写入失败:', err instanceof Error ? err.message : err)
    })
}

function formatTimestamp(): string {
  const d = new Date()
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  )
}

export const appLogger = {
  info(scope: string, message: string): void {
    writeLine('INFO', scope, message)
  },
  warn(scope: string, message: string): void {
    writeLine('WARN', scope, message)
  },
  error(scope: string, message: string): void {
    writeLine('ERROR', scope, message)
  }
}
