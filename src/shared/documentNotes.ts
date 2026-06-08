import type { SavedDocumentType } from './readingProgress'

/** 笔记添加时的阅读锚点 */
export interface DocumentNoteAnchor {
  docPath: string
  docType: SavedDocumentType
  /** 文档显示名（用于跨文档笔记列表） */
  docName?: string
  /** PDF 页码（1-based） */
  pdfPage?: number
  pdfScrollRatio?: number
  scrollTop?: number
  scrollRatio?: number
  monacoLine?: number
  monacoColumn?: number
  /** Markdown 视图模式（添加笔记时） */
  mdViewMode?: 'preview' | 'source'
  /** 添加时选中的原文摘录（可选） */
  quoteText?: string
}

export interface DocumentNoteEntry {
  id: string
  bodyMarkdown: string
  anchor: DocumentNoteAnchor
  /** 父笔记 id；无则为顶层 */
  parentId?: string
  /** @deprecated 仅用于旧数据迁移，请用 parentId */
  depth?: number
  /** 手动排序序号（同父级兄弟间） */
  sortIndex?: number
  createdAt: string
  updatedAt: string
  collapsed?: boolean
}

export interface DocumentNoteThread {
  docPath: string
  docTitle: string
  entries: DocumentNoteEntry[]
  updatedAt: string
}

export type NoteSortMode = 'manual' | 'history' | 'document'
