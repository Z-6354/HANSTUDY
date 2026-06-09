import type { ChatContextSnapshot } from './aiContext'
import type { ChatImageAttachment } from './chatPayload'

export type { ChatImageAttachment } from './chatPayload'

export interface TextRange {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  startOffset?: number
  endOffset?: number
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

export interface ChatToolStepRecord {
  id: string
  name: string
  status: 'running' | 'done' | 'error'
  output?: string
  error?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  contextText?: string
  /** 发送时附带的笔记 / 文档引用（不含正文） */
  contextItems?: ChatContextSnapshot[]
  /** API 失败等错误信息，以助手气泡展示 */
  isError?: boolean
  /** Agent 模式工具调用步骤（流式结束后保留） */
  toolSteps?: ChatToolStepRecord[]
  /** 用户消息附带的图片（data URL） */
  images?: ChatImageAttachment[]
}

export interface TextSelectionContext {
  docPath: string
  text: string
  range?: TextRange
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

export type WorkbenchMode = 'browse' | 'compose' | 'generate' | 'feedback'
