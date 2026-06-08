import { describe, expect, it } from 'vitest'
import { parseNotebookExport, serializeNotebookExport } from '../src/shared/notebookExport'
import type { Notebook } from '../src/shared/notebooks'

const sample: Notebook = {
  id: 'notebook-test',
  name: '测试',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  defaultSortMode: 'manual',
  linkedDocPaths: ['/a.md'],
  entries: [
    {
      id: 'e1',
      bodyMarkdown: 'hello',
      anchor: { docPath: '/a.md', docType: 'md', docName: 'a.md' },
      sortIndex: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
  ]
}

describe('notebookExport', () => {
  it('round-trips through serialize and parse', () => {
    const raw = serializeNotebookExport(sample)
    const parsed = parseNotebookExport(raw)
    expect(parsed.name).toBe('测试')
    expect(parsed.entries).toHaveLength(1)
    expect(parsed.entries[0]?.bodyMarkdown).toBe('hello')
  })

  it('accepts bare notebook json', () => {
    const parsed = parseNotebookExport(JSON.stringify(sample))
    expect(parsed.id).toBe('notebook-test')
  })
})
