import { AI_NOTE_DOC_PATH } from '@shared/aiNoteMarkdown'
import type { DocumentNoteEntry } from '@shared/documentNotes'
import { DEFAULT_NOTEBOOK_ID } from '@shared/notebooks'
import { nextSortIndexForParent } from './documentNoteEntries'
import { useWorkspaceStore } from '../../stores/workspaceStore'

function newEntryId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export async function insertAiNoteEntry(
  markdown: string,
  source?: string,
  aiSessionId?: string
): Promise<void> {
  const notebookId =
    useWorkspaceStore.getState().activeNotebookId ?? DEFAULT_NOTEBOOK_ID
  const notebook = await window.api.notebooks.get(notebookId)
  if (!notebook) throw new Error('无笔记本')

  const now = new Date().toISOString()
  const entry: DocumentNoteEntry = {
    id: newEntryId(),
    bodyMarkdown: markdown,
    anchor: {
      docPath: AI_NOTE_DOC_PATH,
      docType: 'unknown',
      docName: source ?? 'AI 对话',
      aiSessionId
    },
    sortIndex: nextSortIndexForParent(notebook.entries, null),
    createdAt: now,
    updatedAt: now,
    collapsed: false
  }

  await window.api.notebooks.save({
    ...notebook,
    entries: [...notebook.entries, entry],
    updatedAt: now
  })
}
