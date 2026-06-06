import type { Skill } from '../../../shared/skills'

export const MAX_DESCRIPTION_CODEPOINTS = 500
export const MAX_ENABLED_SKILLS = 20
export const MAX_INDEX_CHARS = 4096

export function formatSkillIndex(enabled: Skill[]): string {
  if (!enabled.length) return ''

  let effective = enabled
  if (enabled.length > MAX_ENABLED_SKILLS) {
    effective = [...enabled]
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX_ENABLED_SKILLS)
    console.warn(
      `[skills] 已检测到 ${enabled.length} 个 skill，仅前 ${MAX_ENABLED_SKILLS} 个进入 system prompt 索引`
    )
  }

  let sb = '## 可用 Skills\n\n'
  for (const skill of effective) {
    const desc = truncateByCodepoint(skill.description.trim(), MAX_DESCRIPTION_CODEPOINTS)
    sb += `- **${skill.name}**：${desc}\n`
  }

  sb +=
    '\n当用户任务匹配某个 skill 的场景时，请严格遵循下方「已激活 Skill」中的完整指引；' +
    '若无已激活 Skill，则根据索引中的描述自行判断是否需要该领域的专门流程。\n'

  if (sb.length > MAX_INDEX_CHARS) {
    console.warn(`[skills] skill 索引段超过 ${MAX_INDEX_CHARS} 字符，已截断`)
    return sb.slice(0, MAX_INDEX_CHARS) + '\n...(skill 索引段被截断)\n'
  }

  return sb
}

export function formatLoadedSkillBodies(skills: Skill[]): string {
  if (!skills.length) return ''

  let sb = ''
  for (const skill of skills) {
    const body = truncateBytes(skill.body.trim(), MAX_SKILL_BODY_BYTES)
    sb += `## 已激活 Skill：${skill.name}\n${body}\n\n`
  }
  sb += '---\n'
  return sb
}

export const MAX_SKILL_BODY_BYTES = 5120

function truncateByCodepoint(s: string, limit: number): string {
  const chars = Array.from(s)
  if (chars.length <= limit) return s
  return chars.slice(0, limit).join('') + '...'
}

function truncateBytes(s: string, limit: number): string {
  if (Buffer.byteLength(s, 'utf-8') <= limit) return s
  let result = ''
  for (const ch of s) {
    const next = result + ch
    if (Buffer.byteLength(next, 'utf-8') > limit) break
    result = next
  }
  return result + '\n...(skill 正文被截断)\n'
}
