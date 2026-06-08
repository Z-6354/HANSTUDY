// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { fitStaleCanvasToSlot, type PdfPageSlot } from '../src/renderer/src/features/reader/viewers/pdfLazyRender'

function makeSlot(baseWidth: number, baseHeight: number): PdfPageSlot {
  const wrap = document.createElement('div')
  const canvas = document.createElement('canvas')
  canvas.className = 'pdf-page'
  canvas.width = baseWidth * 2
  canvas.height = baseHeight * 2
  wrap.appendChild(canvas)
  return {
    pageNo: 1,
    wrap,
    baseWidth,
    baseHeight,
    rendered: true,
    rendering: false,
    textHandle: null
  }
}

describe('pdfLazyRender', () => {
  it('fitStaleCanvasToSlot stretches when slot scale differs from bitmap scale', () => {
    const slot = makeSlot(100, 200)
    fitStaleCanvasToSlot(slot, 1.5, 1)
    const canvas = slot.wrap.querySelector('canvas.pdf-page') as HTMLCanvasElement
    expect(canvas.style.width).toBe('100%')
    expect(canvas.style.height).toBe('100%')
  })

  it('fitStaleCanvasToSlot sets CSS px size when slot matches bitmap scale (HiDPI safe)', () => {
    const slot = makeSlot(100, 200)
    fitStaleCanvasToSlot(slot, 1.2, 1.2)
    const canvas = slot.wrap.querySelector('canvas.pdf-page') as HTMLCanvasElement
    expect(canvas.style.width).toBe('120px')
    expect(canvas.style.height).toBe('240px')
  })
})
