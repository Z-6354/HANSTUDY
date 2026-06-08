import { describe, expect, it } from 'vitest'
import {
  collectSessionContextNotes,
  formatContextChipLabel,
  mergeChatContextItems,
  snapshotChatContextItems
} from '../src/shared/aiContext'

describe('mergeChatContextItems', () => {
  it('returns undefined for empty list', () => {
    expect(mergeChatContextItems([])).toBeUndefined()
  })

  it('merges document and note items with separators', () => {
    const merged = mergeChatContextItems([
      { id: '1', kind: 'document', label: 'readme.md', content: 'hello', hint: '章节：Intro' },
      { id: '2', kind: 'note', label: '我的笔记', content: 'note body' }
    ])
    expect(merged?.fileName).toContain('readme.md')
    expect(merged?.content).toContain('【readme.md · 章节：Intro】')
    expect(merged?.content).toContain('---')
    expect(merged?.content).toContain('note body')
  })
})

describe('snapshotChatContextItems', () => {
  it('stores display fields without message body', () => {
    const snapshot = snapshotChatContextItems([
      {
        id: '1',
        kind: 'note',
        label: '第一章',
        content: 'secret body',
        hint: '段落 3',
        noteEntryId: 'entry-1',
        notebookId: 'nb-1'
      }
    ])
    expect(snapshot).toEqual([
      {
        kind: 'note',
        label: '第一章',
        hint: '段落 3',
        noteEntryId: 'entry-1',
        notebookId: 'nb-1',
        docPath: undefined,
        anchor: undefined
      }
    ])
    expect(snapshot[0]).not.toHaveProperty('content')
  })
})

describe('formatContextChipLabel', () => {
  it('formats note labels with doc and anchor hints', () => {
    expect(
      formatContextChipLabel({ kind: 'note', label: 'readme.md', hint: '段落 2' })
    ).toBe('笔记 · readme.md · 段落 2')
  })
})

describe('collectSessionContextNotes', () => {
  it('deduplicates note refs across user messages', () => {
    const notes = collectSessionContextNotes([
      {
        role: 'user',
        contextItems: [
          { kind: 'note', label: 'A', noteEntryId: 'e1' },
          { kind: 'document', label: 'doc.md' }
        ]
      },
      {
        role: 'user',
        contextItems: [{ kind: 'note', label: 'A', noteEntryId: 'e1' }]
      },
      {
        role: 'assistant',
        contextItems: [{ kind: 'note', label: 'B', noteEntryId: 'e2' }]
      }
    ])
    expect(notes).toHaveLength(1)
    expect(notes[0].noteEntryId).toBe('e1')
  })
})
