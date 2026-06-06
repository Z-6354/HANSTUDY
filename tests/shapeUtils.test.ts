import { describe, expect, it } from 'vitest'
import {
  clientToContentPoint,
  hitTestAnnotation,
  normalizeRect,
  shapeToPixels
} from '../src/renderer/src/features/reader/annotations/shapeUtils'
import type { Annotation } from '../src/shared/types'

function mockSurface(opts: {
  scrollWidth: number
  scrollHeight: number
  scrollLeft?: number
  scrollTop?: number
  left?: number
  top?: number
}): HTMLElement {
  const { scrollWidth, scrollHeight, scrollLeft = 0, scrollTop = 0, left = 0, top = 0 } =
    opts
  return {
    scrollWidth,
    scrollHeight,
    scrollLeft,
    scrollTop,
    getBoundingClientRect: () => ({
      left,
      top,
      width: scrollWidth,
      height: scrollHeight,
      right: left + scrollWidth,
      bottom: top + scrollHeight,
      x: left,
      y: top,
      toJSON: () => ({})
    })
  } as HTMLElement
}

describe('shapeUtils rules', () => {
  it('normalizeRect orders corners', () => {
    const rect = normalizeRect({ x: 0.8, y: 0.7 }, { x: 0.2, y: 0.1 })
    expect(rect.x).toBe(0.2)
    expect(rect.y).toBe(0.1)
    expect(rect.width).toBeCloseTo(0.6)
    expect(rect.height).toBeCloseTo(0.6)
  })

  it('shapeToPixels scales normalized coordinates', () => {
    expect(shapeToPixels({ x: 0.5, y: 0.5, width: 0.2, height: 0.1 }, 1000, 500)).toEqual({
      x: 500,
      y: 250,
      width: 200,
      height: 50,
      strokeWidth: 2
    })
  })

  it('clientToContentPoint maps viewport click to normalized point', () => {
    const surface = mockSurface({ scrollWidth: 200, scrollHeight: 100, left: 10, top: 20 })
    expect(clientToContentPoint(110, 70, surface)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('hitTestAnnotation detects rect and pen strokes', () => {
    const surface = mockSurface({ scrollWidth: 1000, scrollHeight: 1000 })
    const rectAnn: Annotation = {
      id: 'r1',
      docPath: '/x',
      type: 'rect',
      color: '#000',
      createdAt: '',
      shape: { x: 0.1, y: 0.1, width: 0.2, height: 0.2, strokeWidth: 2 }
    }
    expect(hitTestAnnotation(rectAnn, 250, 250, surface)).toBe(true)
    expect(hitTestAnnotation(rectAnn, 10, 10, surface)).toBe(false)

    const penAnn: Annotation = {
      id: 'p1',
      docPath: '/x',
      type: 'pen',
      color: '#000',
      createdAt: '',
      shape: {
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.5, y: 0.5 }
        ],
        strokeWidth: 2
      }
    }
    expect(hitTestAnnotation(penAnn, 300, 300, surface)).toBe(true)
  })
})
