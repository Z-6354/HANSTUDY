import type { ChatContextSnapshot } from './aiContext'
import { formatContextChipLabel } from './aiContext'
import type { ChatMessage } from './types'

export const AI_NOTE_DOC_PATH = '__hanstudy_ai__'

export function isAiNoteAnchor(docPath: string, aiSessionId?: string): boolean {
  return docPath === AI_NOTE_DOC_PATH || Boolean(aiSessionId)
}

function normalizeBlock(text: string): string {
  return text.trim()
}

function formatContextLabels(items?: ChatContextSnapshot[]): string[] {
  if (!items?.length) return []
  return items.map((item) => formatContextChipLabel(item))
}

export function formatAiExchangeNoteMarkdown(options: {
  question?: string
  answer: string
  sessionTitle?: string
  contextLabels?: string[]
}): string {
  const { question, answer, sessionTitle, contextLabels } = options
  const lines: string[] = []

  if (sessionTitle?.trim()) {
    lines.push(`## ${sessionTitle.trim()}`, '')
  }

  if (contextLabels?.length) {
    lines.push(`> 引用：${contextLabels.join('、')}`, '')
  }

  if (question?.trim()) {
    lines.push('### 问', '', normalizeBlock(question), '')
  }

  lines.push('### 答', '', normalizeBlock(answer))

  return lines.join('\n')
}

export function findPrecedingUserMessage(
  messages: ChatMessage[],
  assistantMessageId: string
): ChatMessage | undefined {
  const idx = messages.findIndex((m) => m.id === assistantMessageId)
  if (idx <= 0) return undefined
  for (let i = idx - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'user' && msg.content.trim()) return msg
  }
  return undefined
}

export function formatAiSessionNoteMarkdown(
  messages: ChatMessage[],
  sessionTitle?: string
): string {
  const lines: string[] = []
  if (sessionTitle?.trim()) {
    lines.push(`## ${sessionTitle.trim()}`, '')
  }

  const blocks: Array<{
    question?: string
    answer?: string
    contextLabels?: string[]
  }> = []

  let pendingUser: { content: string; contextLabels?: string[] } | null = null

  for (const msg of messages) {
    if (msg.role === 'user') {
      if (pendingUser) {
        blocks.push({ question: pendingUser.content, contextLabels: pendingUser.contextLabels })
      }
      pendingUser = {
        content: msg.content.trim(),
        contextLabels: formatContextLabels(msg.contextItems)
      }
      continue
    }

    if (msg.role !== 'assistant' || !msg.content.trim()) continue

    if (pendingUser) {
      blocks.push({
        question: pendingUser.content,
        answer: msg.content.trim(),
        contextLabels: pendingUser.contextLabels
      })
      pendingUser = null
    } else {
      blocks.push({ answer: msg.content.trim() })
    }
  }

  if (pendingUser) {
    blocks.push({ question: pendingUser.content, contextLabels: pendingUser.contextLabels })
  }

  if (blocks.length === 0) return '（空对话）'

  blocks.forEach((block, index) => {
    if (block.contextLabels?.length) {
      lines.push(`> 引用：${block.contextLabels.join('、')}`, '')
    }
    if (block.question) {
      lines.push('### 问', '', block.question, '')
    }
    if (block.answer) {
      lines.push('### 答', '', block.answer)
    }
    if (index < blocks.length - 1) lines.push('', '---', '')
  })

  return lines.join('\n').trim()
}
