import { describe, expect, it } from 'vitest'
import type { DocumentNoteEntry } from '../src/shared/documentNotes'
import {
  insertEntryAfter,
  insertEntryAsChild
} from '../src/renderer/src/features/notes/documentNoteEntries'

function entry(id: string, extra: Partial<DocumentNoteEntry> = {}): DocumentNoteEntry {
  return {
    id,
    bodyMarkdown: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    anchor: { docPath: '/a.txt', docType: 'txt' },
    ...extra
  }
}

describe('insertEntryAsChild', () => {
  it('inserts as child of parent entry', () => {
    const parent = entry('a', { sortIndex: 0 })
    const newChild = entry('x')
    const result = insertEntryAsChild([parent], 'a', newChild)
    const child = result.find((e) => e.id === 'x')
    expect(child?.parentId).toBe('a')
    expect(child?.sortIndex).toBe(0)
  })
})

describe('insertEntryAfter', () => {
  it('inserts sibling after target with same parent', () => {
    const parent = entry('a', { sortIndex: 0 })
    const child = entry('b', { parentId: 'a', sortIndex: 0 })
    const newOne = entry('x')
    const result = insertEntryAfter([parent, child], 'b', newOne)
    const siblings = result.filter((e) => e.parentId === 'a')
    expect(siblings.map((e) => e.id)).toEqual(['b', 'x'])
  })

  it('appends when id not found', () => {
    const result = insertEntryAfter([entry('a')], 'missing', entry('z'))
    expect(result.map((e) => e.id)).toEqual(['a', 'z'])
  })
})
