import type { ChatMode } from '../shared/types'

export interface ChatModeOption {
  id: ChatMode
  label: string
  description: string
}

export const CHAT_MODES: ChatModeOption[] = [
  {
    id: 'chat',
    label: '对话模式',
    description: '自然对话，快速问答与日常交流'
  },
  {
    id: 'agent',
    label: '智能体模式',
    description: '多步规划与任务分解，适合复杂问题'
  },
  {
    id: 'reading',
    label: '阅读模式',
    description: '专注文档理解、摘要与精读辅助'
  }
]

export function getSystemPromptForMode(mode: ChatMode): string {
  switch (mode) {
    case 'agent':
      return (
        '你是智能体助手，具备任务规划与分步执行能力。' +
        '面对复杂问题时先拆解步骤，再给出清晰、可操作的回答。' +
        '使用中文，结构分明，必要时使用列表。'
      )
    case 'reading':
      return (
        '你是专业阅读助手，帮助用户理解、摘要和精读文档。' +
        '回答应紧扣文档内容，区分事实与推断，引用关键句段。' +
        '使用中文，表达简洁准确。'
      )
    case 'chat':
    default:
      return '你是文档阅读助手，帮助用户理解、总结和解释文档内容。回答简洁清晰，使用中文。'
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
