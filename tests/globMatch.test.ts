import { describe, expect, it } from 'vitest'
import { matchGlob, normalizeGlobPattern } from '../src/shared/globMatch'

describe('globMatch', () => {
  it('normalizes bare filename to **/pattern', () => {
    expect(normalizeGlobPattern('*.pdf')).toBe('**/*.pdf')
  })

  it('matches pdf files recursively', () => {
    expect(matchGlob('**/*.pdf', 'papers/ml/intro.pdf')).toBe(true)
    expect(matchGlob('**/*.pdf', 'readme.md')).toBe(false)
  })

  it('matches filename-only patterns', () => {
    expect(matchGlob('*论文*', '深度学习论文.pdf')).toBe(true)
    expect(matchGlob('*论文*', 'notes/深度学习论文.pdf')).toBe(true)
  })
})
