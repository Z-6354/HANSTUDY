import {
  getModelMeta,
  inferProviderId,
  modelSupportsThinking
} from '../../shared/aiProviders'
import type { OpenAiToolSchema } from '../../shared/agent/tools'
import { getAISettings, normalizeApiKey } from './aiService'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  name?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
}

export interface LlmToolCall {
  id: string
  name: string
  arguments: string
}

export interface LlmCompletionResult {
  content: string
  toolCalls: LlmToolCall[]
}

function buildThinkingBody(providerId: string, modelId: string, thinkingOn: boolean): Record<string, unknown> | undefined {
  if (!modelSupportsThinking(modelId)) return undefined
  return { thinking: { type: thinkingOn ? 'enabled' : 'disabled' } }
}

function formatApiError(status: number, errText: string, providerId: string): string {
  try {
    const json = JSON.parse(errText) as { error?: { message?: string }; message?: string }
    const apiMsg = json.error?.message ?? json.message
    if (apiMsg) return `AI 请求失败 (${status}): ${apiMsg}`
  } catch {
    // ignore
  }
  return `AI 请求失败 (${status}): ${errText.slice(0, 240)}`
}

export class LlmClient {
  async streamChat(
    messages: LlmMessage[],
    onChunk: (text: string) => void,
    signal: AbortSignal
  ): Promise<string> {
    const settings = await getAISettings()
    const apiKey = normalizeApiKey(settings.apiKey)
    if (!apiKey) throw new Error('请先在「软件设置 → 系统配置」中填写并保存 API 密钥')

    const baseUrl = settings.baseUrl.replace(/\/$/, '')
    const providerId = settings.provider || inferProviderId(baseUrl)
    const body: Record<string, unknown> = {
      model: settings.model,
      messages,
      stream: true,
      temperature: 0.7
    }
    const modelMeta = getModelMeta(settings.model)
    const thinkingOn = settings.enableThinking ?? modelMeta?.defaultThinking ?? false
    const thinkingBody = buildThinkingBody(providerId, settings.model, thinkingOn)
    if (thinkingBody) Object.assign(body, thinkingBody)

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
      throw new Error(formatApiError(response.status, await response.text(), providerId))
    }
    if (!response.body) throw new Error('AI 响应为空')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

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
          // ignore
        }
      }
    }
    return fullText
  }

  async completeWithTools(
    messages: LlmMessage[],
    tools: OpenAiToolSchema[],
    signal: AbortSignal
  ): Promise<LlmCompletionResult> {
    const settings = await getAISettings()
    const apiKey = normalizeApiKey(settings.apiKey)
    if (!apiKey) throw new Error('请先在「软件设置 → 系统配置」中填写并保存 API 密钥')

    const baseUrl = settings.baseUrl.replace(/\/$/, '')
    const providerId = settings.provider || inferProviderId(baseUrl)
    const body: Record<string, unknown> = {
      model: settings.model,
      messages,
      tools,
      tool_choice: 'auto',
      stream: false,
      temperature: 0.7
    }
    const modelMeta = getModelMeta(settings.model)
    const thinkingOn = settings.enableThinking ?? modelMeta?.defaultThinking ?? false
    const thinkingBody = buildThinkingBody(providerId, settings.model, thinkingOn)
    if (thinkingBody) Object.assign(body, thinkingBody)

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
      throw new Error(formatApiError(response.status, await response.text(), providerId))
    }

    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
        }
      }>
    }
    const message = json.choices?.[0]?.message
    const toolCalls: LlmToolCall[] =
      message?.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments
      })) ?? []

    return {
      content: message?.content ?? '',
      toolCalls
    }
  }
}
