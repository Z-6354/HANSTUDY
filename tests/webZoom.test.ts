import { describe, expect, it } from 'vitest'
import { clampWebZoom, webZoomOrigin } from '../src/shared/webZoom'

describe('webZoom', () => {
  it('clamps zoom factor', () => {
    expect(clampWebZoom(0.2)).toBe(0.5)
    expect(clampWebZoom(5)).toBe(3)
    expect(clampWebZoom(1.234)).toBe(1.23)
  })

  it('extracts origin for persistence key', () => {
    expect(webZoomOrigin('https://example.com/path?q=1')).toBe('https://example.com')
    expect(webZoomOrigin('')).toBe('')
  })
})
