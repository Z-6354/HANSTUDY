import { describe, expect, it } from 'vitest'
import { buildGenerateNoteMarkdown } from '../src/renderer/src/features/generate/useGenerateDraft'

describe('buildGenerateNoteMarkdown', () => {
  it('combines title and body', () => {
    expect(buildGenerateNoteMarkdown('标题', '正文')).toBe('# 标题\n\n正文')
  })

  it('returns body only when title empty', () => {
    expect(buildGenerateNoteMarkdown('', '只有正文')).toBe('只有正文')
  })

  it('returns empty for blank input', () => {
    expect(buildGenerateNoteMarkdown('  ', '\n')).toBe('')
  })
})
