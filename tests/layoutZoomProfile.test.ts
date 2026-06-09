import { describe, expect, it } from 'vitest'
import { layoutZoomProfile } from '../src/shared/layoutZoomProfile'
import { pdfScaleProgressPatch, savedPdfScale } from '../src/shared/pdfLayoutZoom'
import type { ReadingProgress } from '../src/shared/readingProgress'

describe('layoutZoomProfile', () => {
  it('encodes sidebar and AI panel visibility', () => {
    expect(layoutZoomProfile(true, true)).toBe('L1R1')
    expect(layoutZoomProfile(true, false)).toBe('L1R0')
    expect(layoutZoomProfile(false, true)).toBe('L0R1')
    expect(layoutZoomProfile(false, false)).toBe('L0R0')
  })
})

describe('pdfLayoutZoom', () => {
  it('prefers layout-specific scale when present', () => {
    const saved: ReadingProgress = {
      docPath: '/test.pdf',
      updatedAt: '',
      pdfScale: 1.1,
      pdfScaleByLayout: { L0R0: 1.5 }
    }
    expect(savedPdfScale(saved, 'browse', 'L0R0')).toBe(1.5)
    expect(savedPdfScale(saved, 'browse', 'L1R1')).toBe(1.1)
  })

  it('merges layout scale patches', () => {
    const existing: ReadingProgress = {
      docPath: '/test.pdf',
      updatedAt: '',
      pdfScaleByLayout: { L1R1: 1.2 }
    }
    const patch = pdfScaleProgressPatch('browse', 'L0R1', 1.4, existing)
    expect(patch.pdfScaleByLayout).toEqual({ L1R1: 1.2, L0R1: 1.4 })
  })
})
