import { appendFile, mkdir, readFile } from 'fs/promises'
import { join } from 'path'
import type { AuditEntry } from '../../shared/auditLog'
import { localLogDayStamp } from '../../shared/logDayStamp'

let writeChain = Promise.resolve()

export class AuditLog {
  private readonly auditDir: string

  constructor(auditDir: string) {
    this.auditDir = auditDir
  }

  getAuditDir(): string {
    return this.auditDir
  }

  todayFilePath(): string {
    return join(this.auditDir, `audit-${localLogDayStamp()}.jsonl`)
  }

  async record(entry: AuditEntry | null): Promise<void> {
    if (!entry) return
    writeChain = writeChain.then(async () => {
      try {
        await mkdir(this.auditDir, { recursive: true })
        await appendFile(this.todayFilePath(), JSON.stringify(entry) + '\n', 'utf-8')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[audit] 审计日志写入失败:', message)
      }
    })
    await writeChain
  }

  async readRecent(n: number): Promise<AuditEntry[]> {
    if (n <= 0) return []
    try {
      const raw = await readFile(this.todayFilePath(), 'utf-8')
      const lines = raw.split('\n').filter((line) => line.trim())
      const slice = lines.slice(Math.max(0, lines.length - n))
      const entries: AuditEntry[] = []
      for (const line of slice) {
        try {
          entries.push(JSON.parse(line) as AuditEntry)
        } catch {
          // 跳过损坏行
        }
      }
      return entries
    } catch {
      return []
    }
  }
}
