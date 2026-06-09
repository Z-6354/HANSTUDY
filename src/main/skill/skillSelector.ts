import type { ChatMode } from '../../shared/types'
import type { Skill } from '../../shared/skills'

const MODE_BOOST: Record<ChatMode, string[]> = {
  reading: ['doc-summary', 'term-explain', 'mindmap-generator'],
  agent: ['doc-summary', 'term-explain', 'mindmap-generator'],
  chat: []
}

const TRIGGER_PATTERNS: Array<{ names: string[]; pattern: RegExp; score: number }> = [
  {
    names: ['mindmap-generator'],
    pattern: /导图|思维导图|mind\s*map|outline|结构图|大纲|框架/i,
    score: 15
  },
  {
    names: ['doc-summary'],
    pattern: /摘要|总结|概括|精读|要点|讲了什么|主要内容|说了什么|章节|这段讲|本节/i,
    score: 15
  },
  {
    names: ['term-explain'],
    pattern: /术语|解释|含义|什么意思|概念|是什么|定义|指的是|为何|为什么/i,
    score: 15
  },
  {
    names: ['doc-summary'],
    pattern: /帮我读|读一下|梳理|提炼/i,
    score: 10
  },
  {
    names: ['term-explain'],
    pattern: /这句话|这一段|这个词|看不懂|不理解/i,
    score: 12
  }
]

export function selectSkillsForChat(
  enabled: Skill[],
  userMessage: string,
  chatMode: ChatMode,
  excluded: Set<string>,
  maxAuto = 2
): Skill[] {
  const message = userMessage.trim()
  if (!message) return []

  const threshold = chatMode === 'reading' ? 3 : chatMode === 'agent' ? 4 : 5

  const scored = enabled
    .filter((skill) => !excluded.has(skill.name))
    .map((skill) => ({ skill, score: scoreSkill(skill, message, chatMode) }))
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, maxAuto).map((item) => item.skill)
}

function scoreSkill(skill: Skill, message: string, chatMode: ChatMode): number {
  let score = 0
  const lower = message.toLowerCase()

  if (lower.includes(skill.name) || lower.includes(skill.name.replace(/-/g, ' '))) {
    score += 10
  }

  for (const tag of skill.tags) {
    if (lower.includes(tag.toLowerCase())) score += 3
  }

  for (const chunk of skill.description.split(/[，。、\s]+/)) {
    if (chunk.length >= 2 && message.includes(chunk)) score += 2
  }

  if (MODE_BOOST[chatMode].includes(skill.name)) score += 2

  for (const rule of TRIGGER_PATTERNS) {
    if (rule.names.includes(skill.name) && rule.pattern.test(message)) {
      score += rule.score
    }
  }

  if (chatMode === 'reading' && skill.name === 'term-explain' && /段|句|行/.test(message)) {
    score += 4
  }
  if (chatMode === 'reading' && skill.name === 'doc-summary' && /全文|整篇|文章/.test(message)) {
    score += 4
  }

  return score
}

export function shouldIncludeSkillIndex(chatMode: ChatMode, enabledCount: number): boolean {
  if (enabledCount === 0) return false
  return chatMode === 'agent' || chatMode === 'reading' || enabledCount > 0
}
