import type { DocumentNoteAnchor } from '@shared/documentNotes'
import type { ChatContextItem } from '@shared/aiContext'
import type { SavedDocumentType } from '@shared/readingProgress'
import { scrollElementIntoScrollParent } from '../reader/viewers/pdfViewerPerf'
import { useChatStore } from '../../stores/chatStore'
import { resetPageZoom } from '../../utils/pageZoomReset'
import { noteDocBasename } from './documentNoteSort'
import { useWorkspaceStore, type DocumentType } from '../../stores/workspaceStore'

/** 侧栏/笔记列展开后等待布局 settle（同 PDF openSidePanelSafely） */
export const NOTE_FOCUS_SETTLE_MS = 80

export function prepareLayoutChangeForNoteFocus(): void {
  resetPageZoom()
}

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

export function navigateToAiSession(sessionId: string): void {
  prepareLayoutChangeForNoteFocus()
  useChatStore.getState().switchSession(sessionId)
  useWorkspaceStore.getState().openAIPanel()
}

export function focusNoteEntryInPanel(entryId: string | undefined): void {
  if (!entryId) return
  const el = document.querySelector(`[data-note-entry-id="${CSS.escape(entryId)}"]`)
  if (!(el instanceof HTMLElement)) return
  scrollElementIntoScrollParent(el, 24)
  el.classList.add('doc-note-entry--focused')
  window.setTimeout(() => el.classList.remove('doc-note-entry--focused'), 1800)
  requestAnimationFrame(() => resetPageZoom())
}

export function focusNoteEntryInPanelAfterSettle(entryId: string | undefined): void {
  if (!entryId) return
  prepareLayoutChangeForNoteFocus()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      globalThis.setTimeout(() => focusNoteEntryInPanel(entryId), NOTE_FOCUS_SETTLE_MS)
    })
  })
}

export async function navigateToChatContextItem(
  item: ChatContextItem,
  dispatch: (next: DocumentNoteAnchor) => void
): Promise<void> {
  if (item.kind === 'note') {
    if (!item.noteEntryId) return
    prepareLayoutChangeForNoteFocus()
    useWorkspaceStore.getState().requestNoteFocus(item.noteEntryId, item.notebookId)
    return
  }

  if (item.kind === 'document' && item.docPath) {
    const anchor: DocumentNoteAnchor = item.anchor ?? {
      docPath: item.docPath,
      docType: 'unknown',
      docName: item.label
    }
    await navigateToNoteEntry(anchor, dispatch)
  }
}
