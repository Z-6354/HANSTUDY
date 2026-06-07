// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import type { Annotation } from '../src/shared/types'
import {
  findMarkupElementAtPoint,
  hitTestMarkupAnnotation,
  matchMarkupAnnotation,
  offsetToRange,
  rangeToOffsets
} from '../src/renderer/src/features/reader/annotations/textUtils'

describe('textUtils offset rules', () => {
  const sample = 'line1\nline2\nline3'

  it('offsetToRange maps byte offsets to line/column', () => {
    expect(offsetToRange(sample, 0, 5)).toEqual({
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 6,
      startOffset: 0,
      endOffset: 5
    })
    expect(offsetToRange(sample, 6, 11)).toMatchObject({
      startLine: 2,
      startColumn: 1,
      endLine: 2,
      endColumn: 6
    })
  })

  it('rangeToOffsets round-trips with stored offsets', () => {
    const range = offsetToRange(sample, 6, 11)
    expect(rangeToOffsets(sample, range)).toEqual({ start: 6, end: 11 })
  })

  it('rangeToOffsets computes from line/column when offsets absent', () => {
    expect(
      rangeToOffsets(sample, {
        startLine: 3,
        startColumn: 1,
        endLine: 3,
        endColumn: 6
      })
    ).toEqual({ start: 12, end: 17 })
  })
})

describe('markup eraser hit test', () => {
  const baseAnn = (patch: Partial<Annotation>): Annotation => ({
    id: patch.id ?? 'a1',
    docPath: '/doc',
    type: 'highlight',
    color: '#ff0',
    createdAt: '',
    selectedText: 'hello world',
    ...patch
  })

  it('matchMarkupAnnotation prefers exact and most recent match', () => {
    const older = baseAnn({ id: 'old', selectedText: 'hello' })
    const newer = baseAnn({ id: 'new', selectedText: 'hello world' })
    expect(matchMarkupAnnotation([older, newer], 'hello world')).toEqual(newer)
    expect(matchMarkupAnnotation([older, newer], 'hello')).toEqual(newer)
  })

  it('findMarkupElementAtPoint skips overlay and finds mark/u', () => {
    const root = document.createElement('div')
    const overlay = document.createElement('svg')
    overlay.className = 'annotation-overlay-layer'
    const mark = document.createElement('mark')
    mark.className = 'annotation-highlight'
    mark.textContent = 'highlighted'
    root.append(overlay, mark)
    document.body.appendChild(root)

    root.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }) as DOMRect
    mark.getBoundingClientRect = () =>
      ({ left: 10, top: 10, width: 80, height: 20, right: 90, bottom: 30 }) as DOMRect
    overlay.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }) as DOMRect

    document.elementsFromPoint = (x, y) => {
      if (x >= 10 && x <= 90 && y >= 10 && y <= 30) return [overlay, mark]
      return [overlay]
    }

    expect(findMarkupElementAtPoint(root, 50, 20)).toBe(mark)

    document.body.removeChild(root)
  })

  it('hitTestMarkupAnnotation removes matching highlight by click', () => {
    const root = document.createElement('div')
    const mark = document.createElement('u')
    mark.className = 'annotation-underline'
    mark.textContent = 'sample text'
    root.appendChild(mark)
    document.body.appendChild(root)

    root.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }) as DOMRect
    mark.getBoundingClientRect = () =>
      ({ left: 5, top: 5, width: 100, height: 20, right: 105, bottom: 25 }) as DOMRect

    document.elementsFromPoint = () => [mark]

    const ann = baseAnn({ id: 'u1', type: 'underline', selectedText: 'sample text' })
    expect(hitTestMarkupAnnotation([ann], 20, 10, root)).toEqual(ann)

    document.body.removeChild(root)
  })
})
