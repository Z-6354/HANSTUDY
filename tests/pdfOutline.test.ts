import { describe, expect, it } from 'vitest'
import { flattenPdfOutline, loadPdfOutline, type PdfOutlineItem } from '../src/renderer/src/features/reader/viewers/pdfOutline'

describe('pdfOutline', () => {
  it('flattenPdfOutline preserves depth order', () => {
    const tree: PdfOutlineItem[] = [
      {
        title: '第一章',
        page: 1,
        level: 0,
        children: [
          { title: '1.1 节', page: 2, level: 1, children: [] },
          { title: '1.2 节', page: 5, level: 1, children: [] }
        ]
      },
      { title: '第二章', page: 10, level: 0, children: [] }
    ]
    const flat = flattenPdfOutline(tree)
    expect(flat.map((i) => i.title)).toEqual(['第一章', '1.1 节', '1.2 节', '第二章'])
  })

  it('loadPdfOutline is exported for PdfViewer', () => {
    expect(typeof loadPdfOutline).toBe('function')
  })
})
