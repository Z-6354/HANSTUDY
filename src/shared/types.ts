export type AnnotationType = 'highlight' | 'underline' | 'note' | 'pen' | 'rect'

export type AnnotationTool =
  | 'select'
  | 'pen'
  | 'rect'
  | 'highlight'
  | 'underline'
  | 'note'
  | 'eraser'

export interface ShapePoint {
  /** 0–1，相对文档内容表面宽度 */
  x: number
  /** 0–1，相对文档内容表面高度 */
  y: number
}

export interface DrawShape {
  points?: ShapePoint[]
  x?: number
  y?: number
  width?: number
  height?: number
  strokeWidth?: number
}

export interface TextRange {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  startOffset?: number
  endOffset?: number
}

export interface PdfAnchor {
  page: number
  x: number
  y: number
}

export interface Annotation {
  id: string
  docPath: string
  type: AnnotationType
  color: string
  selectedText?: string
  content?: string
  range?: TextRange
  pdfAnchor?: PdfAnchor
  shape?: DrawShape
  createdAt: string
}

export interface AISettings {
  provider: string
  baseUrl: string
  model: string
  apiKey: string
  /** 深度思考；仅对支持 thinking 的模型生效 */
  enableThinking?: boolean
}

export type ChatMode = 'agent' | 'chat' | 'reading'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  contextText?: string
  /** API 失败等错误信息，以助手气泡展示 */
  isError?: boolean
}

export interface TextSelectionContext {
  docPath: string
  text: string
  range?: TextRange
  pdfAnchor?: PdfAnchor
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}
