// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  buildPdfSelectionFromAnchorFocus,
  collectPdfTextSegments,
  findPdfTextRangeInTextLayer,
  getSortedPdfTextSpans,
  groupPdfSpansByLine,
  pdfSelectedTextFromEndpoints
} from '../src/renderer/src/features/reader/annotations/pdfTextSelection'

function mockSpan(text: string, top: number, left: number): HTMLSpanElement {
  const span = document.createElement('span')
  span.textContent = text
  span.getBoundingClientRect = () =>
    ({
      top,
      left,
      right: left + text.length * 8,
      bottom: top + 14,
      width: text.length * 8,
      height: 14
    }) as DOMRect
  return span
}

function buildMockTextLayer(): HTMLElement {
  const layer = document.createElement('div')
  layer.className = 'textLayer'
  const line1a = mockSpan('Hel', 100, 10)
  const line2 = mockSpan('World', 120, 10)
  const line1b = mockSpan('lo', 100, 40)
  const line3 = mockSpan('Tail', 140, 10)
  layer.append(line2, line3, line1a, line1b)
  document.body.appendChild(layer)
  return layer
}

describe('pdfTextSelection', () => {
  it('groups spans by visual line', () => {
    const layer = buildMockTextLayer()
    const spans = getSortedPdfTextSpans(layer)
    const lines = groupPdfSpansByLine(spans)
    expect(lines.length).toBe(3)
    expect(lines[0].map((s) => s.textContent).join('')).toBe('Hello')
    expect(lines[1][0].textContent).toBe('World')
    document.body.removeChild(layer)
  })

  it('builds same-line selection without grabbing lines below', () => {
    const layer = buildMockTextLayer()
    const lines = groupPdfSpansByLine(getSortedPdfTextSpans(layer))
    const startSpan = lines[0][0]
    const endSpan = lines[0][1]
    const startNode = startSpan.firstChild as Text
    const endNode = endSpan.firstChild as Text

    const result = buildPdfSelectionFromAnchorFocus(
      layer,
      { node: startNode, offset: 0 },
      { node: endNode, offset: 2 }
    )

    expect(result?.text).toBe('Hello')
    expect(result?.text).not.toContain('World')
    expect(result?.text).not.toContain('Tail')
    document.body.removeChild(layer)
  })

  it('collects text in visual order with newlines', () => {
    const layer = buildMockTextLayer()
    const { fullText } = collectPdfTextSegments(layer)
    expect(fullText).toBe('Hello\nWorld\nTail')
    document.body.removeChild(layer)
  })

  it('findPdfTextRangeInTextLayer matches single line without spanning below', () => {
    const layer = buildMockTextLayer()
    expect(findPdfTextRangeInTextLayer(layer, 'World')?.toString()).toBe('World')
    expect(findPdfTextRangeInTextLayer(layer, 'Hello')?.toString()).toBe('Hello')
    expect(findPdfTextRangeInTextLayer(layer, 'Hello\nWorld\nTail')).toBeNull()
    document.body.removeChild(layer)
  })

  it('pdfSelectedTextFromEndpoints joins multiple lines when dragged', () => {
    const layer = buildMockTextLayer()
    const lines = groupPdfSpansByLine(getSortedPdfTextSpans(layer))
    const text = pdfSelectedTextFromEndpoints(lines, 0, 0, 0, 1, 0, 5)
    expect(text).toBe('Hello\nWorld')
    document.body.removeChild(layer)
  })
})
