import { describe, expect, it } from 'vitest'
import {
  FALLBACK_HIGHLIGHT,
  toHighlightBackground,
  resolveStoredMarkupColor
} from '../src/renderer/src/features/reader/annotations/annotationMarkup'

describe('annotationMarkup highlight background', () => {
  it('converts solid hex to translucent rgba', () => {
    const bg = toHighlightBackground('#f59e0b')
    expect(bg).toMatch(/^rgba\(\d+, \d+, \d+, 0\.24\)$/)
    expect(bg).not.toBe('#f59e0b')
  })

  it('caps opaque rgba alpha', () => {
    expect(toHighlightBackground('rgba(255, 213, 0, 0.9)')).toBe('rgba(255, 213, 0, 0.24)')
  })

  it('resolveStoredMarkupColor converts stored hex highlights', () => {
    expect(
      resolveStoredMarkupColor({ type: 'highlight', color: '#ef4444' })
    ).toBe('rgba(239, 68, 68, 0.24)')
  })

  it('fallback is readable translucent yellow', () => {
    expect(FALLBACK_HIGHLIGHT).toContain('0.24')
  })
})
