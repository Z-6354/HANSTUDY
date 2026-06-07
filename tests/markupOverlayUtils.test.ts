// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import type { Annotation } from '../src/shared/types'
import {
  clientRectToContentRect,
  hitTestMarkupOverlay,
  mergeContentRectsForHighlight,
  mergeContentRectsForUnderline,
  mergeLineRectsToHighlightBar,
  mergeLineRectsToUnderlineBar,
  resolveDomMarkupRects
} from '../src/renderer/src/features/reader/annotations/markupOverlayUtils'

describe('markupOverlayUtils', () => {
  const baseAnn = (patch: Partial<Annotation>): Annotation => ({
    id: patch.id ?? 'a1',
    docPath: '/doc',
    type: 'highlight',
    color: '#ff0',
    createdAt: '',
    selectedText: 'hello world',
    ...patch
  })

  it('clientRectToContentRect maps viewport rect into scroll content space', () => {
    const surface = document.createElement('div')
    const content = document.createElement('div')
    surface.appendChild(content)
    document.body.appendChild(surface)

    Object.defineProperty(surface, 'scrollLeft', { value: 40, writable: true })
    Object.defineProperty(surface, 'scrollTop', { value: 80, writable: true })
    surface.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 }) as DOMRect
    content.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 }) as DOMRect

    const mapped = clientRectToContentRect(
      new DOMRect(10, 20, 50, 18),
      surface
    )
    expect(mapped).toEqual({ x: 50, y: 100, width: 50, height: 18 })

    document.body.removeChild(surface)
  })

  it('resolveDomMarkupRects does not mutate document markup', () => {
    const surface = document.createElement('div')
    const root = document.createElement('div')
    root.innerHTML = '<p>hello world</p>'
    surface.appendChild(root)
    document.body.appendChild(surface)

    surface.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect

    const ann = baseAnn({ selectedText: 'hello world' })
    const htmlBefore = root.innerHTML
    resolveDomMarkupRects(ann, surface, root)
    expect(root.innerHTML).toBe(htmlBefore)
    expect(root.querySelector('mark, u')).toBeNull()

    document.body.removeChild(surface)
  })

  it('hitTestMarkupOverlay detects highlight by overlay rect', () => {
    const surface = document.createElement('div')
    document.body.appendChild(surface)
    surface.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect

    const ann = baseAnn({ id: 'h1', selectedText: 'test' })
    const resolver = () => [{ x: 10, y: 10, width: 80, height: 20 }]

    expect(hitTestMarkupOverlay([ann], 50, 20, surface, resolver)).toEqual(ann)
    expect(hitTestMarkupOverlay([ann], 5, 5, surface, resolver)).toBeUndefined()

    document.body.removeChild(surface)
  })

  it('mergeContentRectsForUnderline draws one bar per line at lowest bottom', () => {
    const mixedLine = [
      { x: 10, y: 20, width: 14, height: 18 },
      { x: 26, y: 24, width: 20, height: 12 },
      { x: 48, y: 22, width: 16, height: 14 }
    ]
    const [bar] = mergeContentRectsForUnderline(mixedLine)
    expect(bar.x).toBe(10)
    expect(bar.width).toBe(54)
    expect(bar.y).toBe(20 + 18 + 3)
    expect(bar.height).toBe(2)

    const twoLines = [
      ...mixedLine,
      { x: 10, y: 50, width: 30, height: 16 }
    ]
    const bars = mergeContentRectsForUnderline(twoLines)
    expect(bars).toHaveLength(2)
    expect(bars[1].y).toBe(50 + 16 + 3)
  })

  it('mergeContentRectsForHighlight merges mixed-height chars into one block per line', () => {
    const mixedLine = [
      { x: 10, y: 20, width: 14, height: 18 },
      { x: 26, y: 24, width: 20, height: 12 },
      { x: 48, y: 22, width: 16, height: 14 }
    ]
    const [block] = mergeContentRectsForHighlight(mixedLine)
    expect(block).toEqual({
      x: 10,
      y: 20,
      width: 54,
      height: 18
    })

    const bar = mergeLineRectsToHighlightBar(mixedLine)
    expect(bar.height).toBe(20 + 18 - 20)
  })

  it('hitTestMarkupOverlay uses merged highlight blocks', () => {
    const surface = document.createElement('div')
    document.body.appendChild(surface)
    surface.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect

    const ann = baseAnn({ id: 'h1', type: 'highlight', selectedText: 'test' })
    const charRects = [
      { x: 10, y: 20, width: 8, height: 16 },
      { x: 18, y: 24, width: 10, height: 12 }
    ]
    const block = mergeLineRectsToHighlightBar(charRects)
    const resolver = () => charRects

    expect(hitTestMarkupOverlay([ann], block.x + 5, block.y + 5, surface, resolver)).toEqual(ann)

    document.body.removeChild(surface)
  })

  it('hitTestMarkupOverlay uses merged underline bars', () => {
    const surface = document.createElement('div')
    document.body.appendChild(surface)
    surface.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect

    const ann = baseAnn({ id: 'u1', type: 'underline', selectedText: 'test' })
    const charRects = [
      { x: 10, y: 20, width: 8, height: 16 },
      { x: 18, y: 24, width: 10, height: 12 }
    ]
    const bar = mergeLineRectsToUnderlineBar(charRects)
    const resolver = () => charRects

    expect(hitTestMarkupOverlay([ann], bar.x + 5, bar.y + 1, surface, resolver)).toEqual(ann)
    expect(hitTestMarkupOverlay([ann], bar.x + 5, 20, surface, resolver)).toBeUndefined()

    document.body.removeChild(surface)
  })
})
