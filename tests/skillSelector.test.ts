import { describe, expect, it } from 'vitest'
import { selectSkillsForChat } from '../src/main/skill/skillSelector'
import type { Skill } from '../src/shared/skills'

const enabled: Skill[] = [
  {
    name: 'doc-summary',
    description: '结构化摘要',
    version: '1',
    author: 't',
    tags: ['reading', 'summary'],
    source: 'builtin',
    skillMdPath: '',
    body: ''
  },
  {
    name: 'term-explain',
    description: '术语解释',
    version: '1',
    author: 't',
    tags: ['reading'],
    source: 'builtin',
    skillMdPath: '',
    body: ''
  },
  {
    name: 'mindmap-generator',
    description: '思维导图',
    version: '1',
    author: 't',
    tags: ['reading'],
    source: 'builtin',
    skillMdPath: '',
    body: ''
  }
]

describe('selectSkillsForChat', () => {
  it('selects doc-summary for summary intent in reading mode', () => {
    const picked = selectSkillsForChat(enabled, '请总结这段要点', 'reading', new Set())
    expect(picked.map((s) => s.name)).toContain('doc-summary')
  })

  it('selects term-explain for meaning questions', () => {
    const picked = selectSkillsForChat(enabled, '这个词是什么意思', 'reading', new Set())
    expect(picked.map((s) => s.name)).toContain('term-explain')
  })

  it('selects mindmap for outline requests', () => {
    const picked = selectSkillsForChat(enabled, '画一个思维导图大纲', 'agent', new Set())
    expect(picked.map((s) => s.name)).toContain('mindmap-generator')
  })

  it('respects excluded skills', () => {
    const picked = selectSkillsForChat(
      enabled,
      '请总结全文',
      'reading',
      new Set(['doc-summary'])
    )
    expect(picked.map((s) => s.name)).not.toContain('doc-summary')
  })
})
