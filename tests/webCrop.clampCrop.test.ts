import { describe, expect, it } from 'vitest'
import { clampCrop, WEB_CROP_MIN_SPAN } from '../src/shared/webCrop'

describe('clampCrop edge cases', () => {
  it('shrinks left bound when crop is pinned to the right edge', () => {
    expect(clampCrop({ left: 0.99, right: 1 })).toEqual({ left: 0.88, right: 1 })
  })

  it('resets to full width when bounds collapse', () => {
    expect(clampCrop({ left: 1, right: 1 })).toEqual({ left: 0, right: 1 })
  })

  it('always returns span >= WEB_CROP_MIN_SPAN or full range', () => {
    const samples = [
      { left: 0, right: 1 },
      { left: 0.5, right: 0.51 },
      { left: -1, right: 2 },
      { left: 0.45, right: 0.55 }
    ]
    for (const crop of samples) {
      const out = clampCrop(crop)
      const span = out.right - out.left
      expect(span >= WEB_CROP_MIN_SPAN || (out.left === 0 && out.right === 1)).toBe(true)
      expect(out.left).toBeGreaterThanOrEqual(0)
      expect(out.right).toBeLessThanOrEqual(1)
      expect(out.left).toBeLessThan(out.right)
    }
  })
})
