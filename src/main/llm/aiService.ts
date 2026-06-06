import { app, safeStorage } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  getDefaultAISettings,
  getModelMeta,
  getProviderById,
  inferProviderId,
  modelSupportsThinking
} from '../../shared/aiProviders'
import { getSystemPromptForMode } from '../../shared/chatModes'
import type { AISettings, ChatMode } from '../../shared/types'
import { resolveSkillsForChat } from '../skill/skillService'

const SETTINGS_FILE = 'ai-settings.json'
const ENC_PREFIX = 'enc:'
const B64_PREFIX = 'b64:'

async function getSettingsPath(): Promise<string> {
  const dir = join(app.getPath('userData'), 'data')
  await mkdir(dir, { recursive: true })
  return join(dir, SETTINGS_FILE)
}

interface StoredSettings {
  provider?: string
  baseUrl: string
  model: string
  apiKeyEnc?: string
  enableThinking?: boolean
}

export function normalizeApiKey(key: string): string {
  let normalized = key.trim()
  if (/^bearer\s+/i.test(normalized)) {
    normalized = normalized.replace(/^bearer\s+/i, '').trim()
  }
  return normalized
}

function looksLikeApiKey(value: string): boolean {
  if (!value || value.length < 8 || value.length > 512) return false
  return /^[\x20-\x7e]+$/.test(value)
}

function encryptKey(key: string): string | undefined {
  const normalized = normalizeApiKey(key)
  if (!normalized) return undefined
  if (safeStorage.isEncryptionAvailable()) {
    return ENC_PREFIX + safeStorage.encryptString(normalized).toString('base64')
  }
  return B64_PREFIX + Buffer.from(normalized, 'utf-8').toString('base64')
}

function decryptKey(enc?: string): string {
  if (!enc) return ''

  if (enc.startsWith(ENC_PREFIX)) {
    const payload = enc.slice(ENC_PREFIX.length)
    if (!safeStorage.isEncryptionAvailable()) return ''
    try {
      const value = safeStorage.decryptString(Buffer.from(payload, 'base64'))
      return looksLikeApiKey(value) ? value : ''
    } catch {
      return ''
    }
  }

  if (enc.startsWith(B64_PREFIX)) {
    try {
      const value = Buffer.from(enc.slice(B64_PREFIX.length), 'base64').toString('utf-8')
      return looksLikeApiKey(value) ? value : ''
    } catch {
      return ''
    }
  }

  // 旧版：带 safeStorage 加密、无前缀
  if (safeStorage.isEncryptionAvailable()) {
    try {
      const value = safeStorage.decryptString(Buffer.from(enc, 'base64'))
      if (looksLikeApiKey(value)) return value
    } catch {
      // fall through
    }
  }

  // 旧版：明文 base64（safeStorage 不可用时写入）
  try {
    const value = Buffer.from(enc, 'base64').toString('utf-8')
    if (looksLikeApiKey(value)) return value
  } catch {
    // ignore
  }

  return ''
}

export async function getAISettings(): Promise<AISettings> {
  const defaults = getDefaultAISettings()
  try {
    const path = await getSettingsPath()
    const raw = await readFile(path, 'utf-8')
    const stored = JSON.parse(raw) as StoredSettings
    const provider = stored.provider || inferProviderId(stored.baseUrl || defaults.baseUrl)
    let baseUrl = stored.baseUrl || defaults.baseUrl
    if (provider === 'volcengine') {
      const migrated = normalizeVolcengineBaseUrl(baseUrl)
      if (migrated !== baseUrl.replace(/\/$/, '')) {
        baseUrl = migrated
        stored.baseUrl = migrated
        stored.provider = 'volcengine'
        await writeFile(path, JSON.stringify(stored, null, 2), 'utf-8')
      }
    }
    return {
      provider,
      baseUrl,
      model: stored.model || defaults.model,
      apiKey: decryptKey(stored.apiKeyEnc),
      enableThinking: stored.enableThinking
    }
  } catch {
    return { ...defaults, apiKey: '' }
  }
}

export async function saveAISettings(settings: AISettings): Promise<void> {
  const defaults = getDefaultAISettings()
  const path = await getSettingsPath()
  const provider = settings.provider.trim() || defaults.provider
  let baseUrl = settings.baseUrl.trim() || defaults.baseUrl
  if (provider === 'volcengine') {
    baseUrl = normalizeVolcengineBaseUrl(baseUrl)
  }
  const stored: StoredSettings = {
    provider,
    baseUrl,
    model: settings.model.trim() || defaults.model,
    apiKeyEnc: encryptKey(settings.apiKey),
    enableThinking: settings.enableThinking
  }
  await writeFile(path, JSON.stringify(stored, null, 2), 'utf-8')
}

function normalizeVolcengineBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, '')
  if (!trimmed.includes('volces.com')) return trimmed
  if (trimmed.includes('/api/plan/v3')) return trimmed
  if (trimmed.endsWith('/api/plan')) return `${trimmed}/v3`
  // 旧版在线推理地址 → Plan OpenAI 兼容地址
  if (trimmed.includes('/api/v3') || trimmed.includes('/api/coding/v3')) {
    return 'https://ark.cn-beijing.volces.com/api/plan/v3'
  }
  if (trimmed.includes('ark.cn-beijing.volces.com')) {
    return 'https://ark.cn-beijing.volces.com/api/plan/v3'
  }
  return trimmed
}

function parseApiErrorMessage(errText: string): string | null {
  try {
    const json = JSON.parse(errText) as {
      error?: { message?: string; code?: string }
      message?: string
    }
    return json.error?.message ?? json.message ?? null
  } catch {
    return null
  }
}

function formatApiError(status: number, errText: string, providerId: string): string {
  const apiMsg = parseApiErrorMessage(errText)

  if (status === 401) {
    if (providerId === 'volcengine') {
      return (
        `API 认证失败 (401)\n\n` +
        `${apiMsg ?? 'API Key 缺失或无效'}\n\n` +
        `火山方舟 Plan 请逐项确认：\n` +
        `1. 使用 Plan 套餐专用 API Key（方舟控制台 → Plan → API Key 管理）\n` +
        `   不要使用普通「在线推理」的 Key，二者不通用\n` +
        `2. 接口地址：https://ark.cn-beijing.volces.com/api/plan/v3\n` +
        `3. 模型：deepseek-v4-flash 或 ep-xxx 接入点 ID\n` +
        `4. 在「软件设置 → 系统配置」完整粘贴 Key 后保存（勿加 Bearer 前缀）`
      )
    }
    const provider = getProviderById(providerId)
    const hint = provider?.apiKeyHint ?? '请确认密钥有效且未过期'
    return (
      `API 认证失败 (401)\n\n` +
      `${apiMsg ?? '密钥无效、未保存或解密失败'}\n\n` +
      `${hint}\n` +
      `请在「软件设置 → 系统配置」中重新填写 API 密钥并保存。`
    )
  }

  if (apiMsg) {
    return `AI 请求失败 (${status}): ${apiMsg}`
  }
  const snippet = errText.slice(0, 240).trim()
  return snippet ? `AI 请求失败 (${status}): ${snippet}` : `AI 请求失败 (${status})`
}

function buildThinkingBody(
  providerId: string,
  modelId: string,
  thinkingOn: boolean
): Record<string, unknown> | undefined {
  if (!modelSupportsThinking(modelId)) return undefined

  if (providerId === 'minimax') {
    return { thinking: { type: thinkingOn ? 'enabled' : 'disabled' } }
  }

  return { thinking: { type: thinkingOn ? 'enabled' : 'disabled' } }
}

export interface ChatRequest {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  contextText?: string
  documentContext?: { fileName: string; content: string }
  chatMode?: ChatMode
  excludedSkills?: string[]
}

export interface ChatResult {
  text: string
  activeSkills: Array<{ name: string; description: string }>
}

export async function streamChat(
  request: ChatRequest,
  onChunk: (text: string) => void,
  signal: AbortSignal
): Promise<ChatResult> {
  const settings = await getAISettings()
  const apiKey = normalizeApiKey(settings.apiKey)
  if (!apiKey) {
    throw new Error('请先在「软件设置 → 系统配置」中填写并保存 API 密钥')
  }

  const baseUrl = settings.baseUrl.replace(/\/$/, '')
  const providerId = settings.provider || inferProviderId(baseUrl)
  const chatMode = request.chatMode ?? 'chat'

  const lastUserMessage =
    [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const skillContext = await resolveSkillsForChat(
    lastUserMessage,
    chatMode,
    request.excludedSkills
  )

  let systemPrompt = getSystemPromptForMode(chatMode)
  if (skillContext.systemPromptExtra) {
    systemPrompt = `${systemPrompt}\n\n${skillContext.systemPromptExtra}`
  }

  const contextMessages: Array<{ role: 'user'; content: string }> = []
  if (request.documentContext?.content) {
    contextMessages.push({
      role: 'user',
      content: `以下是我加入对话的参考文档「${request.documentContext.fileName}」：\n\n${request.documentContext.content}`
    })
  }
  if (request.contextText) {
    contextMessages.push({
      role: 'user',
      content: `以下是我选中的文档片段：\n\n${request.contextText}`
    })
  }

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...contextMessages,
    ...request.messages.filter((m) => m.role !== 'system')
  ]

  const body: Record<string, unknown> = {
    model: settings.model,
    messages,
    stream: true,
    temperature: 0.7
  }

  const modelMeta = getModelMeta(settings.model)
  const thinkingOn = settings.enableThinking ?? modelMeta?.defaultThinking ?? false
  const thinkingBody = buildThinkingBody(providerId, settings.model, thinkingOn)
  if (thinkingBody) {
    Object.assign(body, thinkingBody)
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(formatApiError(response.status, errText, providerId))
  }

  if (!response.body) {
    throw new Error('AI 响应为空')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>
          }
          const delta = json.choices?.[0]?.delta
          const chunk = delta?.content ?? delta?.reasoning_content ?? ''
          if (chunk) {
            fullText += chunk
            onChunk(chunk)
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }
  } catch (err) {
    if (signal.aborted) {
      return { text: fullText, activeSkills: skillContext.meta.activeSkills }
    }
    throw err
  }

  return { text: fullText, activeSkills: skillContext.meta.activeSkills }
}
