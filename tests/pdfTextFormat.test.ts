import { describe, expect, it } from 'vitest'
import { pageTextFromItems } from '../src/shared/pdfTextFormat'

describe('pdfTextFormat rules', () => {
  it('joins items into lines with hasEOL', () => {
    const text = pageTextFromItems([
      { str: 'Hello', hasEOL: false, transform: [1, 0, 0, 1, 0, 100] },
      { str: ' World', hasEOL: true, transform: [1, 0, 0, 1, 50, 100] },
      { str: 'Line2', hasEOL: true, transform: [1, 0, 0, 1, 0, 90] }
    ])
    expect(text).toBe('Hello World\nLine2')
  })

  it('splits on Y delta when hasEOL missing', () => {
    const text = pageTextFromItems([
      { str: 'Top', transform: [1, 0, 0, 1, 0, 200] },
      { str: 'Bottom', transform: [1, 0, 0, 1, 0, 100] }
    ])
    expect(text).toBe('Top\nBottom')
  })

  it('ignores empty items', () => {
    expect(pageTextFromItems([{ str: '' }, { str: 'OK', hasEOL: true }])).toBe('OK')
  })
})
