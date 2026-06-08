import type { DocumentNoteAnchor } from '@shared/documentNotes'
import type { SavedDocumentType } from '@shared/readingProgress'
import { noteDocBasename } from './documentNoteSort'
import { useWorkspaceStore, type DocumentType } from '../../stores/workspaceStore'

function anchorDocTypeToOpen(docType: SavedDocumentType): DocumentType {
  if (docType === 'web') return 'web'
  if (docType === 'txt' || docType === 'md' || docType === 'pdf' || docType === 'docx') return docType
  return 'unknown'
}

export async function openDocumentForNoteAnchor(anchor: DocumentNoteAnchor): Promise<void> {
  const { documents, openDocument, openWebPage, setActiveDocument } = useWorkspaceStore.getState()

  if (anchor.docType === 'web') {
    openWebPage(anchor.docPath)
    return
  }

  const existing = documents.find((d) => d.path === anchor.docPath)
  if (existing) {
    if (useWorkspaceStore.getState().activeDocumentId !== existing.id) {
      setActiveDocument(existing.id)
    }
    return
  }

  let name = anchor.docName?.trim() || noteDocBasename(anchor.docPath)
  let type = anchorDocTypeToOpen(anchor.docType)
  try {
    const info = await window.api.fs.getFileInfo(anchor.docPath)
    if (info.supported) {
      name = info.name
      type = info.type
    }
  } catch {
    // 使用锚点中的回退信息
  }
  openDocument({ path: anchor.docPath, name, type })
}

export async function navigateToNoteEntry(
  anchor: DocumentNoteAnchor,
  dispatch: (next: DocumentNoteAnchor) => void
): Promise<void> {
  await openDocumentForNoteAnchor(anchor)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => dispatch(anchor))
  })
}
