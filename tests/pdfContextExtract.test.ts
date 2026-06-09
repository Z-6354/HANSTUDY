import { describe, expect, it } from 'vitest'
import {
  computePdfPageWindow,
  normalizePdfPageRange,
  resolvePdfCenterPage
} from '../src/shared/pdfContextExtract'

describe('pdfContextExtract', () => {
  it('resolvePdfCenterPage prefers pdfPage', () => {
    expect(resolvePdfCenterPage({ pdfPage: 5, numPages: 10 })).toBe(5)
    expect(resolvePdfCenterPage({ pdfPage: 99, numPages: 10 })).toBe(10)
  })

  it('resolvePdfCenterPage falls back to scrollRatio', () => {
    expect(resolvePdfCenterPage({ scrollRatio: 0.5, numPages: 20 })).toBe(10)
    expect(resolvePdfCenterPage({ scrollRatio: 0, numPages: 8 })).toBe(1)
  })

  it('computePdfPageWindow keeps center within bounds', () => {
    expect(computePdfPageWindow(1, 10, 1)).toEqual({ startPage: 1, endPage: 2 })
    expect(computePdfPageWindow(10, 10, 1)).toEqual({ startPage: 9, endPage: 10 })
    expect(computePdfPageWindow(5, 10, 1)).toEqual({ startPage: 4, endPage: 6 })
  })

  it('normalizePdfPageRange clamps invalid ranges', () => {
    expect(normalizePdfPageRange(0, 99, 12)).toEqual({ startPage: 1, endPage: 12 })
    expect(normalizePdfPageRange(8, 3, 12)).toEqual({ startPage: 8, endPage: 8 })
  })
})
