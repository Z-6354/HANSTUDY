import { describe, expect, it } from 'vitest'
import type { DocumentNoteEntry } from '../src/shared/documentNotes'
import {
  applyNoteTreeDrop,
  deleteEntryCascade,
  getChildren,
  getNotebookChildren,
  migrateDepthToParentId,
  nestEntryUnder,
  nestUnderPreviousSibling,
  nextSortIndexForParent,
  promoteEntry,
  restoreDeletedEntries
} from '../src/renderer/src/features/notes/documentNoteTree'

const DOC = '/book.pdf'

function entry(id: string, extra: Partial<DocumentNoteEntry> = {}): DocumentNoteEntry {
  return {
    id,
    bodyMarkdown: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    anchor: { docPath: DOC, docType: 'pdf' },
    sortIndex: 0,
    ...extra
  }
}

describe('documentNoteTree', () => {
  it('nests entry under parent', () => {
    const all = [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })]
    const next = nestEntryUnder(all, 'b', 'a')
    const child = next.find((e) => e.id === 'b')
    expect(child?.parentId).toBe('a')
    expect(getNotebookChildren(next, 'a', 'manual').map((e) => e.id)).toEqual(['b'])
  })

  it('moves child before parent to promote outward', () => {
    const nested = nestEntryUnder(
      [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })],
      'b',
      'a'
    )
    const next = applyNoteTreeDrop(nested, 'b', 'a', 'before')
    const promoted = next.find((e) => e.id === 'b')
    expect(promoted?.parentId).toBeUndefined()
    expect(getNotebookChildren(next, null, 'manual').map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('moves sibling upward via before intent', () => {
    const all = [
      entry('a', { sortIndex: 0 }),
      entry('b', { sortIndex: 1 }),
      entry('c', { sortIndex: 2 })
    ]
    const next = applyNoteTreeDrop(all, 'c', 'a', 'before')
    expect(getNotebookChildren(next, null, 'manual').map((e) => e.id)).toEqual(['c', 'a', 'b'])
  })

  it('rejects nest onto ancestor', () => {
    const nested = nestEntryUnder(
      [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })],
      'b',
      'a'
    )
    const next = applyNoteTreeDrop(nested, 'b', 'a', 'nest')
    expect(next).toBe(nested)
  })

  it('moves only child after parent when no sibling below', () => {
    const nested = nestEntryUnder(
      [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })],
      'b',
      'a'
    )
    const next = applyNoteTreeDrop(nested, 'b', 'a', 'after')
    expect(next.find((e) => e.id === 'b')?.parentId).toBeUndefined()
    expect(getNotebookChildren(next, null, 'manual').map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('moves last nested child before next root sibling', () => {
    let all = [
      entry('a', { sortIndex: 0 }),
      entry('b', { sortIndex: 1 }),
      entry('c', { sortIndex: 2 })
    ]
    all = nestEntryUnder(all, 'b', 'a')
    const next = applyNoteTreeDrop(all, 'b', 'c', 'before')
    expect(next.find((e) => e.id === 'b')?.parentId).toBeUndefined()
    expect(getNotebookChildren(next, null, 'manual').map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('moves child from one parent to another via nest', () => {
    let all = [
      entry('a', { sortIndex: 0 }),
      entry('b', { sortIndex: 1 }),
      entry('c', { sortIndex: 2 })
    ]
    all = nestEntryUnder(all, 'b', 'a')
    const next = applyNoteTreeDrop(all, 'b', 'c', 'nest')
    expect(next.find((e) => e.id === 'b')?.parentId).toBe('c')
    expect(getNotebookChildren(next, 'c', 'manual').map((e) => e.id)).toEqual(['b'])
  })

  it('ignores nest drop onto current parent', () => {
    const nested = nestEntryUnder(
      [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })],
      'b',
      'a'
    )
    const next = applyNoteTreeDrop(nested, 'b', 'a', 'nest')
    expect(next).toBe(nested)
  })

  it('promotes nested entry to outer level', () => {
    const nested = nestEntryUnder(
      [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })],
      'b',
      'a'
    )
    const next = promoteEntry(nested, 'b')
    expect(next.find((e) => e.id === 'b')?.parentId).toBeUndefined()
  })

  it('nests under previous sibling via indent', () => {
    const all = [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })]
    const next = nestUnderPreviousSibling(all, 'b')
    expect(next.find((e) => e.id === 'b')?.parentId).toBe('a')
  })

  it('deletes entry and descendants', () => {
    let all = nestEntryUnder(
      [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })],
      'b',
      'a'
    )
    all = [...all, entry('c', { parentId: 'b', sortIndex: 0 })]
    const next = deleteEntryCascade(all, 'a')
    expect(next.map((e) => e.id)).toEqual([])
  })

  it('restores deleted entries on undo', () => {
    const all = [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })]
    const next = deleteEntryCascade(all, 'a')
    const restored = restoreDeletedEntries(next, all)
    expect(restored.map((e) => e.id).sort()).toEqual(['a', 'b'])
  })

  it('migrates legacy depth to parentId', () => {
    const all = [
      entry('a', { sortIndex: 0, depth: 0 }),
      entry('b', { sortIndex: 1, depth: 1 })
    ]
    const next = migrateDepthToParentId(all, DOC)
    expect(next.find((e) => e.id === 'b')?.parentId).toBe('a')
    expect(getChildren(next, DOC, 'a', 'manual').map((e) => e.id)).toEqual(['b'])
  })

  it('lists root entries across documents in notebook view', () => {
    const otherDoc = '/notes.md'
    const all = [
      entry('a', { anchor: { docPath: DOC, docType: 'pdf' }, sortIndex: 0 }),
      entry('b', {
        anchor: { docPath: otherDoc, docType: 'md', docName: '学习笔记' },
        sortIndex: 0
      })
    ]
    expect(getNotebookChildren(all, null, 'manual').map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('lists children by parentId even when anchor doc differs', () => {
    const nested = nestEntryUnder(
      [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })],
      'b',
      'a'
    )
    const childFromOtherDoc = {
      ...entry('c', { sortIndex: 0, parentId: 'a' }),
      anchor: { docPath: '/notes.md', docType: 'md' as const, docName: '笔记' }
    }
    const all = [...nested, childFromOtherDoc]
    expect(getNotebookChildren(all, 'a', 'manual').map((e) => e.id)).toEqual(['b', 'c'])
  })

  it('nests entry from another document via drag', () => {
    const otherDoc = '/notes.md'
    const all = [
      entry('a', { sortIndex: 0 }),
      entry('b', { anchor: { docPath: otherDoc, docType: 'md' }, sortIndex: 0 })
    ]
    const next = applyNoteTreeDrop(all, 'b', 'a', 'nest')
    expect(next.find((e) => e.id === 'b')?.parentId).toBe('a')
    expect(getNotebookChildren(next, 'a', 'manual').map((e) => e.id)).toEqual(['b'])
  })

  it('assigns next root sort index across all documents', () => {
    const all = [
      entry('a', { sortIndex: 0 }),
      entry('b', { anchor: { docPath: '/other.pdf', docType: 'pdf' }, sortIndex: 3 })
    ]
    expect(nextSortIndexForParent(all, null)).toBe(4)
  })
})
