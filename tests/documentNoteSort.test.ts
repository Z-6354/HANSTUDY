import { describe, expect, it } from 'vitest'
import type { DocumentNoteEntry } from '../src/shared/documentNotes'
import {
  formatNoteAnchorLabel,
  formatNoteDocLabel,
  sortDocumentNoteEntries
} from '../src/renderer/src/features/notes/documentNoteSort'

function entry(
  id: string,
  createdAt: string,
  anchor: Partial<DocumentNoteEntry['anchor']> = {},
  extra: Partial<DocumentNoteEntry> = {}
): DocumentNoteEntry {
  return {
    id,
    bodyMarkdown: id,
    createdAt,
    updatedAt: createdAt,
    anchor: {
      docPath: '/a.pdf',
      docType: 'pdf',
      ...anchor
    },
    ...extra
  }
}

describe('sortDocumentNoteEntries', () => {
  it('sorts by sortIndex in manual mode', () => {
    const items = [
      entry('b', '2026-01-01T00:00:00.000Z', {}, { sortIndex: 2 }),
      entry('a', '2026-01-02T00:00:00.000Z', {}, { sortIndex: 0 })
    ]
    const sorted = sortDocumentNoteEntries(items, 'manual')
    expect(sorted.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('sorts by createdAt ascending in history mode', () => {
    const items = [
      entry('b', '2026-01-02T00:00:00.000Z'),
      entry('a', '2026-01-01T00:00:00.000Z')
    ]
    const sorted = sortDocumentNoteEntries(items, 'history')
    expect(sorted.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('sorts by pdf page in document mode', () => {
    const items = [
      entry('p3', '2026-01-01T00:00:00.000Z', { pdfPage: 3 }),
      entry('p1', '2026-01-02T00:00:00.000Z', { pdfPage: 1 })
    ]
    const sorted = sortDocumentNoteEntries(items, 'document')
    expect(sorted.map((e) => e.id)).toEqual(['p1', 'p3'])
  })
})

describe('formatNoteDocLabel', () => {
  it('prefers stored docName', () => {
    expect(
      formatNoteDocLabel(entry('x', '2026', { docPath: '/a/b.pdf', docName: '高等数学' }))
    ).toBe('高等数学')
  })

  it('falls back to basename', () => {
    expect(formatNoteDocLabel(entry('x', '2026', { docPath: 'D:/books/chapter-1.pdf' }))).toBe(
      'chapter-1.pdf'
    )
  })
})

describe('formatNoteAnchorLabel', () => {
  it('formats pdf page', () => {
    expect(formatNoteAnchorLabel(entry('x', '2026', { pdfPage: 12 }))).toBe('P.12')
  })

  it('formats monaco line for txt/md', () => {
    expect(formatNoteAnchorLabel(entry('x', '2026', { monacoLine: 42, docType: 'md' }))).toBe(
      'L.42'
    )
  })
})
