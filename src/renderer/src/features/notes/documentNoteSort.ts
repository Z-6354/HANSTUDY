import type { DocumentNoteEntry, NoteSortMode } from '@shared/documentNotes'
import { isAiNoteAnchor } from '@shared/aiNoteMarkdown'

export function noteDocBasename(docPath: string): string {
  const normalized = docPath.replace(/\\/g, '/')
  const slash = normalized.lastIndexOf('/')
  if (slash >= 0) return normalized.slice(slash + 1) || docPath
  return docPath
}

export function formatNoteDocLabel(entry: DocumentNoteEntry): string {
  return entry.anchor.docName?.trim() || noteDocBasename(entry.anchor.docPath)
}

export function anchorSortKey(entry: DocumentNoteEntry): number {
  const a = entry.anchor
  if (a.pdfPage != null && a.pdfPage > 0) {
    return a.pdfPage * 1_000_000 + Math.round((a.pdfScrollRatio ?? 0) * 1000)
  }
  if (a.monacoLine != null && a.monacoLine > 0) {
    return a.monacoLine * 1000 + (a.monacoColumn ?? 0)
  }
  if (a.scrollRatio != null) {
    return Math.round(a.scrollRatio * 1_000_000)
  }
  if (a.scrollTop != null) {
    return a.scrollTop
  }
  return 0
}

export function sortDocumentNoteEntries(
  entries: DocumentNoteEntry[],
  mode: NoteSortMode
): DocumentNoteEntry[] {
  const copy = [...entries]
  if (mode === 'manual') {
    return copy.sort((a, b) => {
      const diff = (a.sortIndex ?? 0) - (b.sortIndex ?? 0)
      if (diff !== 0) return diff
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }
  if (mode === 'history') {
    return copy.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }
  return copy.sort((a, b) => {
    const diff = anchorSortKey(a) - anchorSortKey(b)
    if (diff !== 0) return diff
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

export function formatNoteAnchorLabel(entry: DocumentNoteEntry): string {
  const a = entry.anchor
  if (isAiNoteAnchor(a.docPath, a.aiSessionId)) return 'AI 历史'
  if (a.pdfPage != null && a.pdfPage > 0) return `P.${a.pdfPage}`
  if (a.monacoLine != null && a.monacoLine > 0) return `L.${a.monacoLine}`
  if (a.scrollRatio != null) return `${Math.round(a.scrollRatio * 100)}%`
  return '位置'
}

export function resolveNoteSortMode(
  override: NoteSortMode | null,
  notebookDefault: NoteSortMode
): NoteSortMode {
  return override ?? notebookDefault
}
