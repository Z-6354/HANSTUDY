import type { ChatMode } from '../shared/types'
import { getReadingUnderstandingRules } from './readingAssistant'

export interface ChatModeOption {
  id: ChatMode
  label: string
  description: string
}

export const CHAT_MODES: ChatModeOption[] = [
  {
    id: 'chat',
    label: '对话',
    description: '自然对话，快速问答与日常交流'
  },
  {
    id: 'agent',
    label: '智能体',
    description: '跨资料库阅读与多步任务，可调用工具'
  },
  {
    id: 'reading',
    label: '阅读',
    description: '专注文档理解、摘要与精读辅助'
  }
]

export function getSystemPromptForMode(mode: ChatMode): string {
  switch (mode) {
    case 'agent':
      return (
        '你是阅读智能体，帮助用户理解资料库中的文档并完成跨文件阅读任务。' +
        '可调用工具列举、搜索、分段读取文档；复杂任务先定位材料再回答。' +
        '使用中文。\n\n' +
        getReadingUnderstandingRules({ withTools: true })
      )
    case 'reading':
      return (
        '你是专业阅读助手，帮助用户理解、摘要和精读当前文档。' +
        '回答应紧扣用户提供的文档与选区。使用中文。\n\n' +
        getReadingUnderstandingRules({ withTools: false })
      )
    case 'chat':
    default:
      return (
        '你是文档阅读助手，帮助用户理解、总结和解释内容。' +
        '回答简洁清晰，区分已知事实与推断。使用中文。'
      )
  }
}

export function getContextWindowForModel(modelId: string): number {
  return MODEL_CONTEXT_WINDOWS[modelId] ?? 32000
}

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'deepseek-v4-flash': 128000,
  'deepseek-v4-pro': 128000,
  'deepseek-reasoner': 64000,
  'deepseek-chat': 64000,
  'glm-5.1': 128000,
  'glm-4-flash': 128000,
  'glm-4-plus': 128000,
  'minimax-m2.7': 200000,
  'kimi-k2.6': 128000,
  'moonshot-v1-128k': 128000,
  'moonshot-v1-32k': 32000,
  'moonshot-v1-8k': 8000
}

export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 2.5)
}
