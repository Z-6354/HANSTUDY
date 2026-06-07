// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  clientToContentPoint,
  getOverlayFrame,
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

  it('getOverlayFrame maps surface offset inside shell', () => {
    const shell = document.createElement('div')
    const surface = document.createElement('div')
    Object.defineProperty(surface, 'scrollWidth', { value: 400 })
    Object.defineProperty(surface, 'scrollHeight', { value: 800 })
    Object.defineProperty(surface, 'clientWidth', { value: 400 })
    Object.defineProperty(surface, 'clientHeight', { value: 400 })
    surface.getBoundingClientRect = () =>
      ({
        left: 50,
        top: 80,
        width: 400,
        height: 400,
        right: 450,
        bottom: 480,
        x: 50,
        y: 80,
        toJSON: () => ({})
      }) as DOMRect
    shell.getBoundingClientRect = () =>
      ({
        left: 10,
        top: 20,
        width: 500,
        height: 600,
        right: 510,
        bottom: 620,
        x: 10,
        y: 20,
        toJSON: () => ({})
      }) as DOMRect
    shell.appendChild(surface)
    document.body.appendChild(shell)
    expect(getOverlayFrame(surface, shell)).toEqual({
      left: 40,
      top: 60,
      width: 400,
      height: 800
    })
    shell.remove()
  })

  it('clientToContentPoint maps viewport click to normalized point', () => {
    const surface = mockSurface({ scrollWidth: 200, scrollHeight: 100, left: 10, top: 20 })
    expect(clientToContentPoint(110, 70, surface)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('clientToContentPoint uses pdf-pages-content origin when present', () => {
    const pagesRoot = document.createElement('div')
    pagesRoot.className = 'pdf-pages-root'
    const pagesContent = document.createElement('div')
    pagesContent.className = 'pdf-pages-content'
    Object.defineProperty(pagesContent, 'scrollWidth', { value: 600 })
    Object.defineProperty(pagesContent, 'scrollHeight', { value: 1200 })
    pagesContent.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 80,
        width: 600,
        height: 1200,
        right: 700,
        bottom: 1280,
        x: 100,
        y: 80,
        toJSON: () => ({})
      }) as DOMRect
    pagesRoot.appendChild(pagesContent)
    Object.defineProperty(pagesRoot, 'scrollWidth', { value: 800 })
    Object.defineProperty(pagesRoot, 'scrollHeight', { value: 1200 })
    pagesRoot.getBoundingClientRect = () =>
      ({
        left: 40,
        top: 80,
        width: 800,
        height: 1200,
        right: 840,
        bottom: 1280,
        x: 40,
        y: 80,
        toJSON: () => ({})
      }) as DOMRect

    expect(clientToContentPoint(400, 680, pagesRoot)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('clientToContentPoint does not double-count scroll when surface is nested in pdf-viewer', () => {
    const pdfViewer = document.createElement('div')
    pdfViewer.className = 'pdf-viewer'
    pdfViewer.scrollTop = 500

    const pagesRoot = document.createElement('div')
    pagesRoot.className = 'pdf-pages-root'
    Object.defineProperty(pagesRoot, 'scrollWidth', { value: 800 })
    Object.defineProperty(pagesRoot, 'scrollHeight', { value: 2000 })
    pagesRoot.getBoundingClientRect = () =>
      ({
        left: 40,
        top: 60,
        width: 800,
        height: 2000,
        right: 840,
        bottom: 2060,
        x: 40,
        y: 60,
        toJSON: () => ({})
      }) as DOMRect

    pdfViewer.appendChild(pagesRoot)

    expect(clientToContentPoint(440, 160, pagesRoot)).toEqual({ x: 0.5, y: 0.05 })
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
