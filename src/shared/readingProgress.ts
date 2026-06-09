export type SavedDocumentType =
  | 'txt'
  | 'md'
  | 'pdf'
  | 'docx'
  | 'web'
  | 'unknown'

import type { LayoutZoomProfile } from './layoutZoomProfile'

export interface ReadingProgress {
  docPath: string
  updatedAt: string
  /** PDF 当前页（1-based） */
  pdfPage?: number
  /** PDF 滚动比例 0–1 */
  pdfScrollRatio?: number
  /** PDF 缩放（浏览模式，默认侧栏+AI 均展开时的兼容字段） */
  pdfScale?: number
  /** PDF 缩放（笔记模式，可与浏览模式不同） */
  pdfScaleCompose?: number
  /** PDF 缩放，按侧栏/AI 面板展开组合分档（L0/L1 × R0/R1） */
  pdfScaleByLayout?: Partial<Record<LayoutZoomProfile, number>>
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
  /** 资源管理器当前根目录（资料库或用户打开的文件夹） */
  rootFolder?: string | null
  /** 侧栏是否展开 */
  showSidebar?: boolean
  /** AI 面板是否展开 */
  showAIPanel?: boolean
  /** 侧栏当前标签 */
  sidebarTab?: 'explorer' | 'notes' | 'web'
  updatedAt: string
}
