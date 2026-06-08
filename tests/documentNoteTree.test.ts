import { describe, expect, it } from 'vitest'
import type { DocumentNoteEntry } from '../src/shared/documentNotes'
import {
  applyNoteTreeDrop,
  deleteEntryCascade,
  getChildren,
  migrateDepthToParentId,
  nestEntryUnder,
  nestUnderPreviousSibling,
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
    const next = nestEntryUnder(all, DOC, 'b', 'a')
    const child = next.find((e) => e.id === 'b')
    expect(child?.parentId).toBe('a')
    expect(getChildren(next, DOC, 'a', 'manual').map((e) => e.id)).toEqual(['b'])
  })

  it('moves child before parent to promote outward', () => {
    const nested = nestEntryUnder(
      [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })],
      DOC,
      'b',
      'a'
    )
    const next = applyNoteTreeDrop(nested, DOC, 'b', 'a', 'before')
    const promoted = next.find((e) => e.id === 'b')
    expect(promoted?.parentId).toBeUndefined()
    expect(getChildren(next, DOC, null, 'manual').map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('moves sibling upward via before intent', () => {
    const all = [
      entry('a', { sortIndex: 0 }),
      entry('b', { sortIndex: 1 }),
      entry('c', { sortIndex: 2 })
    ]
    const next = applyNoteTreeDrop(all, DOC, 'c', 'a', 'before')
    expect(getChildren(next, DOC, null, 'manual').map((e) => e.id)).toEqual(['c', 'a', 'b'])
  })

  it('rejects nest onto ancestor', () => {
    const nested = nestEntryUnder(
      [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })],
      DOC,
      'b',
      'a'
    )
    const next = applyNoteTreeDrop(nested, DOC, 'b', 'a', 'nest')
    expect(next).toBe(nested)
  })

  it('moves only child after parent when no sibling below', () => {
    const nested = nestEntryUnder(
      [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })],
      DOC,
      'b',
      'a'
    )
    const next = applyNoteTreeDrop(nested, DOC, 'b', 'a', 'after')
    expect(next.find((e) => e.id === 'b')?.parentId).toBeUndefined()
    expect(getChildren(next, DOC, null, 'manual').map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('moves last nested child before next root sibling', () => {
    let all = [
      entry('a', { sortIndex: 0 }),
      entry('b', { sortIndex: 1 }),
      entry('c', { sortIndex: 2 })
    ]
    all = nestEntryUnder(all, DOC, 'b', 'a')
    const next = applyNoteTreeDrop(all, DOC, 'b', 'c', 'before')
    expect(next.find((e) => e.id === 'b')?.parentId).toBeUndefined()
    expect(getChildren(next, DOC, null, 'manual').map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('moves child from one parent to another via nest', () => {
    let all = [
      entry('a', { sortIndex: 0 }),
      entry('b', { sortIndex: 1 }),
      entry('c', { sortIndex: 2 })
    ]
    all = nestEntryUnder(all, DOC, 'b', 'a')
    const next = applyNoteTreeDrop(all, DOC, 'b', 'c', 'nest')
    expect(next.find((e) => e.id === 'b')?.parentId).toBe('c')
    expect(getChildren(next, DOC, 'c', 'manual').map((e) => e.id)).toEqual(['b'])
  })

  it('ignores nest drop onto current parent', () => {
    const nested = nestEntryUnder(
      [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })],
      DOC,
      'b',
      'a'
    )
    const next = applyNoteTreeDrop(nested, DOC, 'b', 'a', 'nest')
    expect(next).toBe(nested)
  })

  it('promotes nested entry to outer level', () => {
    const nested = nestEntryUnder(
      [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })],
      DOC,
      'b',
      'a'
    )
    const next = promoteEntry(nested, DOC, 'b')
    expect(next.find((e) => e.id === 'b')?.parentId).toBeUndefined()
  })

  it('nests under previous sibling via indent', () => {
    const all = [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })]
    const next = nestUnderPreviousSibling(all, DOC, 'b')
    expect(next.find((e) => e.id === 'b')?.parentId).toBe('a')
  })

  it('deletes entry and descendants', () => {
    let all = nestEntryUnder(
      [entry('a', { sortIndex: 0 }), entry('b', { sortIndex: 1 })],
      DOC,
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
  })
})
