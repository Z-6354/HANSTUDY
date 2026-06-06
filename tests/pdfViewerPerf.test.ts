import { describe, expect, it } from 'vitest'
import {
  applyWheelZoom,
  clampPdfScale,
  computePagesRootTransformOrigin,
  computeZoomFocalScroll,
  getPdfOutputScale,
  isPriorityPdfPage,
  isZoomPreviewing,
  normalizeWheelDelta,
  pageRenderPriority,
  previewScaleRatio,
  wheelDeltaToZoomFactor
} from '../src/renderer/src/features/reader/viewers/pdfViewerPerf'

describe('pdfViewerPerf', () => {
  it('clampPdfScale limits range', () => {
    expect(clampPdfScale(0.1)).toBe(0.5)
    expect(clampPdfScale(5)).toBe(3)
    expect(clampPdfScale(1.2)).toBe(1.2)
  })

  it('normalizeWheelDelta scales line and page modes', () => {
    expect(normalizeWheelDelta(3, 1)).toBe(48)
    expect(normalizeWheelDelta(10, 0)).toBe(10)
  })

  it('wheelDeltaToZoomFactor is smooth and capped per frame', () => {
    expect(wheelDeltaToZoomFactor(-10)).toBeGreaterThan(1)
    expect(wheelDeltaToZoomFactor(10)).toBeLessThan(1)
    expect(wheelDeltaToZoomFactor(5000)).toBeGreaterThanOrEqual(1 / 1.05)
  })

  it('applyWheelZoom uses continuous delta', () => {
    const next = applyWheelZoom(1.2, -30, 0)
    expect(next).toBeGreaterThan(1.2)
    expect(next).toBeLessThanOrEqual(1.26)
  })

  it('previewScaleRatio returns 1 when scales match', () => {
    expect(previewScaleRatio(1.2, 1.2)).toBe(1)
  })

  it('isZoomPreviewing detects preview phase', () => {
    expect(isZoomPreviewing(1.4, 1.2)).toBe(true)
    expect(isZoomPreviewing(1.2, 1.2)).toBe(false)
  })

  it('previewScaleRatio computes ratio', () => {
    expect(previewScaleRatio(1.4, 1.2)).toBeCloseTo(1.1667, 3)
  })

  it('getPdfOutputScale is at least 1', () => {
    expect(getPdfOutputScale()).toBeGreaterThanOrEqual(1)
  })

  it('isPriorityPdfPage marks current and adjacent pages', () => {
    expect(isPriorityPdfPage(5, 5)).toBe(true)
    expect(isPriorityPdfPage(4, 5)).toBe(true)
    expect(isPriorityPdfPage(6, 5)).toBe(true)
    expect(isPriorityPdfPage(3, 5)).toBe(false)
  })

  it('pageRenderPriority prefers closer pages', () => {
    expect(pageRenderPriority(5, 5)).toBe(0)
    expect(pageRenderPriority(4, 5)).toBe(1)
    expect(pageRenderPriority(3, 5)).toBe(2)
  })

  it('computePagesRootTransformOrigin uses layout scroll coords', () => {
    const origin = computePagesRootTransformOrigin(
      150,
      250,
      0,
      100,
      { left: 50, top: 50 },
      20,
      10
    )
    expect(origin).toBe('80px 290px')
  })

  it('computeZoomFocalScroll keeps focal point stable when scaling up', () => {
    const next = computeZoomFocalScroll({
      scrollLeft: 0,
      scrollTop: 200,
      containerRect: { left: 0, top: 0 },
      focalClientX: 400,
      focalClientY: 300,
      scaleFactor: 1.2
    })
    expect(next.scrollTop).toBeCloseTo(300, 5)
    expect(next.scrollLeft).toBeCloseTo(80, 5)
  })
})
