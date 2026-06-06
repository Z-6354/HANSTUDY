import { app } from 'electron'
import { appendFile, mkdir } from 'fs/promises'
import { join } from 'path'

export interface AuditEntry {
  ts: string
  tool: string
  success: boolean
  detail?: string
}

export class AuditLog {
  private async logPath(): Promise<string> {
    const dir = join(app.getPath('userData'), 'audit')
    await mkdir(dir, { recursive: true })
    const day = new Date().toISOString().slice(0, 10)
    return join(dir, `audit-${day}.jsonl`)
  }

  async record(entry: Omit<AuditEntry, 'ts'>): Promise<void> {
    const line: AuditEntry = { ts: new Date().toISOString(), ...entry }
    await appendFile(await this.logPath(), JSON.stringify(line) + '\n', 'utf-8')
  }
}
