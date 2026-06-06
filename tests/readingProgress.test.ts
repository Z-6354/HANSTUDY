import { describe, expect, it } from 'vitest'
import type { ReadingProgress } from '../src/shared/readingProgress'

describe('ReadingProgress types', () => {
  it('allows pdf and scroll fields', () => {
    const p: ReadingProgress = {
      docPath: '/test.pdf',
      updatedAt: new Date().toISOString(),
      pdfPage: 3,
      pdfScrollRatio: 0.42,
      pdfScale: 1.2
    }
    expect(p.pdfPage).toBe(3)
  })
})
