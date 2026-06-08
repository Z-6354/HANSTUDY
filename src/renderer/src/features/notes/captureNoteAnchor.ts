import type { DocumentNoteAnchor } from '@shared/documentNotes'
import type { SavedDocumentType } from '@shared/readingProgress'
import type { TextSelectionContext } from '@shared/types'

export async function captureNoteAnchor(
  docPath: string,
  docType: SavedDocumentType,
  selection: TextSelectionContext | null
): Promise<DocumentNoteAnchor> {
  const progress = await window.api.readingProgress.get(docPath)
  const quoteText =
    selection?.docPath === docPath && selection.text.trim()
      ? selection.text.trim().slice(0, 400)
      : undefined

  return {
    docPath,
    docType,
    pdfPage: progress?.pdfPage,
    pdfScrollRatio: progress?.pdfScrollRatio,
    scrollTop: progress?.scrollTop,
    scrollRatio: progress?.scrollRatio,
    monacoLine: progress?.monacoLine,
    monacoColumn: progress?.monacoColumn,
    mdViewMode: progress?.mdViewMode,
    quoteText
  }
}
