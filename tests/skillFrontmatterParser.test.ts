import { describe, expect, it } from 'vitest'
import {
  listField,
  parseSkillFrontmatter,
  stringField
} from '../src/main/skill/skillFrontmatterParser'

describe('skillFrontmatterParser rules', () => {
  it('parses valid frontmatter and body', () => {
    const raw = `---
name: demo-skill
description: "A demo"
tags: [foo, bar]
---
# Title

Body here.`
    const result = parseSkillFrontmatter(raw)
    expect(result.warnings).toEqual([])
    expect(result.frontmatter.name).toBe('demo-skill')
    expect(result.frontmatter.tags).toEqual(['foo', 'bar'])
    expect(result.body).toContain('# Title')
  })

  it('warns when frontmatter markers missing', () => {
    const result = parseSkillFrontmatter('# no frontmatter')
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.frontmatter).toEqual({})
  })

  it('stringField and listField type-guard values', () => {
    expect(stringField({ name: 'x' }, 'name')).toBe('x')
    expect(stringField({ name: 1 }, 'name')).toBeUndefined()
    expect(listField({ tags: ['a', 2, 'b'] }, 'tags')).toEqual(['a', 'b'])
    expect(listField({ tags: 'nope' }, 'tags')).toEqual([])
  })
})
