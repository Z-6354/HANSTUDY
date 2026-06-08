export type SavedDocumentType =
  | 'txt'
  | 'md'
  | 'pdf'
  | 'docx'
  | 'web'
  | 'unknown'

export interface ReadingProgress {
  docPath: string
  updatedAt: string
  /** PDF 当前页（1-based） */
  pdfPage?: number
  /** PDF 滚动比例 0–1 */
  pdfScrollRatio?: number
  /** PDF 缩放（浏览模式） */
  pdfScale?: number
  /** PDF 缩放（笔记模式，可与浏览模式不同） */
  pdfScaleCompose?: number
  /** 通用滚动像素 */
  scrollTop?: number
  /** 通用滚动比例 0–1 */
  scrollRatio?: number
  /** Monaco 光标/滚动锚点行（1-based） */
  monacoLine?: number
  monacoColumn?: number
  /** Markdown 视图模式 */
  mdViewMode?: 'preview' | 'source'
}

export interface SavedOpenDocument {
  path: string
  name: string
  type: SavedDocumentType
}

export interface WorkspaceSession {
  documents: SavedOpenDocument[]
  activePath: string | null
  /** 侧栏是否展开 */
  showSidebar?: boolean
  /** AI 面板是否展开 */
  showAIPanel?: boolean
  /** 侧栏当前标签 */
  sidebarTab?: 'explorer' | 'notes' | 'web'
  updatedAt: string
}
