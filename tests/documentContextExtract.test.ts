import { describe, expect, it } from 'vitest'
import { extractMdSection, extractTxtWindow } from '../src/shared/documentContextExtract'

describe('extractMdSection', () => {
  const md = `# Intro
line0

## Chapter A
a1
a2

## Chapter B
b1
b2

# Part 2
p1
`

  it('extracts section for line in Chapter A', () => {
    const result = extractMdSection(md, 6)
    expect(result.sectionTitle).toBe('Chapter A')
    expect(result.content).toContain('a1')
    expect(result.content).not.toContain('b1')
  })

  it('falls back to first section when no line given', () => {
    const result = extractMdSection(md)
    expect(result.sectionTitle).toBe('Intro')
    expect(result.content).toContain('line0')
  })
})

describe('extractTxtWindow', () => {
  const lines = Array.from({ length: 500 }, (_, i) => `line ${i + 1}`).join('\n')

  it('centers window around line number', () => {
    const result = extractTxtWindow(lines, 250)
    expect(result.content).toContain('line 250')
    expect(result.content).toContain('前略')
  })
})
