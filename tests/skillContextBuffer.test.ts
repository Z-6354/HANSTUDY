import { describe, expect, it } from 'vitest'
import { MAX_BUFFERED_SKILLS, SkillContextBuffer } from '../src/main/skill/SkillContextBuffer'

describe('SkillContextBuffer', () => {
  it('drains formatted skill bodies once', () => {
    const buffer = new SkillContextBuffer()
    buffer.push('doc-summary', '# 摘要指引')
    const drained = buffer.drain()
    expect(drained).toContain('## 已加载 Skill：doc-summary')
    expect(drained).toContain('# 摘要指引')
    expect(drained).toContain('---')
    expect(buffer.isEmpty()).toBe(true)
  })

  it('replaces duplicate skill and refreshes order', () => {
    const buffer = new SkillContextBuffer()
    buffer.push('a', 'v1')
    buffer.push('b', 'body-b')
    buffer.push('a', 'v2')
    const drained = buffer.drain()
    expect(drained).toContain('v2')
    expect(drained).not.toContain('v1')
    expect(drained.indexOf('body-b')).toBeLessThan(drained.indexOf('v2'))
  })

  it(`evicts oldest when exceeding ${MAX_BUFFERED_SKILLS}`, () => {
    const buffer = new SkillContextBuffer()
    buffer.push('one', '1')
    buffer.push('two', '2')
    buffer.push('three', '3')
    buffer.push('four', '4')
    const drained = buffer.drain()
    expect(drained).not.toContain('one')
    expect(drained).toContain('four')
  })
})
