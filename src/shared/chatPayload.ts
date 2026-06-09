/** OpenAI 兼容的多模态消息片段 */
export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }

export type ChatApiMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string | ChatContentPart[]
}

export interface ChatImageAttachment {
  id: string
  /** data:image/...;base64,... */
  dataUrl: string
  name?: string
}

export const MAX_CHAT_IMAGES = 4
export const MAX_CHAT_IMAGE_BYTES = 4 * 1024 * 1024

export function buildChatApiMessage(msg: {
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: ChatImageAttachment[]
}): ChatApiMessage {
  if (msg.role !== 'user' || !msg.images?.length) {
    return { role: msg.role, content: msg.content }
  }

  const parts: ChatContentPart[] = []
  const text = msg.content.trim()
  if (text) {
    parts.push({ type: 'text', text })
  } else if (msg.images?.length) {
    parts.push({ type: 'text', text: '请查看我发送的图片。' })
  }
  for (const img of msg.images ?? []) {
    parts.push({ type: 'image_url', image_url: { url: img.dataUrl, detail: 'auto' } })
  }
  if (parts.length === 0) {
    parts.push({ type: 'text', text: '' })
  }
  return { role: 'user', content: parts }
}

export function extractMessageText(content: string | ChatContentPart[]): string {
  if (typeof content === 'string') return content
  const text = content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim()
  return text || '（图片）'
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return dataUrl.length
  const base64 = dataUrl.slice(comma + 1)
  return Math.floor((base64.length * 3) / 4)
}
