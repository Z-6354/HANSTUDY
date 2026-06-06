import { mkdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { dirname } from 'path'
import type { SkillState } from '../../../shared/skills'

export class SkillStateStore {
  constructor(private readonly file: string) {}

  get filePath(): string {
    return this.file
  }

  async disabled(): Promise<Set<string>> {
    if (!existsSync(this.file)) return new Set()
    try {
      const content = await readFile(this.file, 'utf-8')
      if (!content.trim()) return new Set()
      const parsed = JSON.parse(content) as SkillState
      const result = new Set<string>()
      for (const name of parsed.disabled ?? []) {
        if (typeof name === 'string' && name.trim()) {
          result.add(name.trim())
        }
      }
      return result
    } catch (err) {
      console.warn('[skills] skills.json 解析失败，忽略禁用列表:', err)
      return new Set()
    }
  }

  async disable(name: string): Promise<void> {
    const set = await this.disabled()
    set.add(name)
    await this.write(set)
  }

  async enable(name: string): Promise<void> {
    const set = await this.disabled()
    set.delete(name)
    await this.write(set)
  }

  private async write(disabled: Set<string>): Promise<void> {
    try {
      await mkdir(dirname(this.file), { recursive: true })
      const payload: SkillState = { disabled: Array.from(disabled) }
      await writeFile(this.file, JSON.stringify(payload, null, 2), 'utf-8')
    } catch (err) {
      console.warn('[skills] skills.json 写入失败:', err)
    }
  }
}
