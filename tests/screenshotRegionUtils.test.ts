import { describe, expect, it } from 'vitest'
import {
  computeToolbarPosition,
  mapWindowRectToCaptureRect,
  normalizeDragRect
} from '../src/renderer/src/features/screenshot/screenshotRegionUtils'

describe('normalizeDragRect', () => {
  it('clamps selection inside viewport', () => {
    expect(normalizeDragRect(10, 20, 300, 220, 1920, 1080)).toEqual({
      x: 10,
      y: 20,
      width: 290,
      height: 200
    })
  })
})

describe('mapWindowRectToCaptureRect', () => {
  it('maps logical selection to capture pixels', () => {
    expect(
      mapWindowRectToCaptureRect(
        { x: 100, y: 50, width: 200, height: 100 },
        1920,
        1080,
        3840,
        2160
      )
    ).toEqual({ x: 200, y: 100, width: 400, height: 200 })
  })
})

describe('computeToolbarPosition', () => {
  it('places toolbar below selection when possible', () => {
    expect(
      computeToolbarPosition(
        { x: 100, y: 100, width: 300, height: 200 },
        112,
        40,
        1920,
        1080
      )
    ).toEqual({ left: 288, top: 308 })
  })
})
