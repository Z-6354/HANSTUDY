// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import type { Annotation } from '../src/shared/types'
import {
  clientRectToContentRect,
  hitTestMarkupOverlay,
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
})
