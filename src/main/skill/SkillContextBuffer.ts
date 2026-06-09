import { MAX_SKILL_BODY_BYTES, truncateSkillBodyBytes } from './skillIndexFormatter'

/** 单轮对话的 skill 注入缓冲区（对齐 hancli SkillContextBuffer） */
export const MAX_BUFFERED_SKILLS = 3

export class SkillContextBuffer {
  private readonly entries = new Map<string, string>()

  push(skillName: string, body: string): void {
    const name = skillName.trim()
    if (!name || !body) return
    this.entries.delete(name)
    this.entries.set(name, truncateSkillBodyBytes(body.trim(), MAX_SKILL_BODY_BYTES))
    while (this.entries.size > MAX_BUFFERED_SKILLS) {
      const oldest = this.entries.keys().next().value
      if (oldest) this.entries.delete(oldest)
    }
  }

  /** 取出全部 skill 正文并清空，返回可前置到 user message 的 markdown 段 */
  drain(): string {
    if (!this.entries.size) return ''
    const snapshot = Array.from(this.entries.entries())
    this.entries.clear()

    let sb = ''
    for (const [name, body] of snapshot) {
      sb += `## 已加载 Skill：${name}\n${body}\n\n`
    }
    sb += '---\n'
    return sb
  }

  isEmpty(): boolean {
    return this.entries.size === 0
  }

  size(): number {
    return this.entries.size
  }

  clear(): void {
    this.entries.clear()
  }
}
