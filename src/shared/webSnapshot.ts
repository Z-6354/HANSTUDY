import type { WebHorizontalCrop } from './webCrop'

export type WebSnapshotFormat = 'pdf'

export interface WebSnapshotMeta {
  id: string
  sourceUrl: string
  finalUrl: string
  title: string
  savedAt: string
  format: WebSnapshotFormat
  contentHash: string
  pdfPath: string
  viewport?: { width: number; height: number }
  crop?: WebHorizontalCrop
}

export interface SaveWebSnapshotInput {
  pdf: number[]
  sourceUrl: string
  finalUrl: string
  title: string
  viewport?: { width: number; height: number }
  crop?: WebHorizontalCrop
}

export function isWebSnapshotPdfPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  return /(?:^|\/)data\/web-snapshots\/[^/]+\/page\.pdf$/i.test(normalized)
}

export function formatWebSnapshotTabTitle(title: string): string {
  const trimmed = title.trim() || '网页快照'
  return trimmed.startsWith('[网页]') ? trimmed : `[网页] ${trimmed}`
}
