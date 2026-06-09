import {
  getModelMeta,
  inferProviderId,
  modelSupportsThinking
} from '../../shared/aiProviders'
import type { OpenAiToolSchema } from '../../shared/agent/tools'
import { getAISettings, normalizeApiKey } from './aiService'

import type { ChatContentPart } from '../../shared/chatPayload'
import { logLlmReasoning } from '../logging/LlmTraceLogger'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | ChatContentPart[] | null
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
    let reasoningText = ''
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
          if (delta?.reasoning_content) {
            reasoningText += delta.reasoning_content
          }
          if (delta?.content) {
            fullText += delta.content
            onChunk(delta.content)
          }
        } catch {
          // ignore
        }
      }
    }
    logLlmReasoning('chat', providerId, settings.model, reasoningText)
    return fullText
  }

  async completeWithTools(
    messages: LlmMessage[],
    tools: OpenAiToolSchema[],
    signal: AbortSignal,
    onChunk?: (text: string) => void
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
      stream: Boolean(onChunk),
      temperature: 0.7
    }
    const modelMeta = getModelMeta(settings.model)
    const thinkingOn = settings.enableThinking ?? modelMeta?.defaultThinking ?? false
    const thinkingBody = buildThinkingBody(providerId, settings.model, thinkingOn)
    if (thinkingBody) Object.assign(body, thinkingBody)

    if (!onChunk) {
      return this.completeWithToolsNonStream(baseUrl, apiKey, providerId, body, signal)
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
      throw new Error(formatApiError(response.status, await response.text(), providerId))
    }
    if (!response.body) throw new Error('AI 响应为空')

    return this.readStreamedToolCompletion(response.body, onChunk, providerId, settings.model, 'agent-tools')
  }

  private async completeWithToolsNonStream(
    baseUrl: string,
    apiKey: string,
    providerId: string,
    body: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<LlmCompletionResult> {
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

  private async readStreamedToolCompletion(
    body: ReadableStream<Uint8Array>,
    onChunk: (text: string) => void,
    providerId: string,
    model: string,
    traceScope: string
  ): Promise<LlmCompletionResult> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    let reasoningText = ''
    const toolAcc = new Map<number, { id?: string; name?: string; arguments: string }>()

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
            choices?: Array<{
              delta?: {
                content?: string
                reasoning_content?: string
                tool_calls?: Array<{
                  index?: number
                  id?: string
                  function?: { name?: string; arguments?: string }
                }>
              }
            }>
          }
          const delta = json.choices?.[0]?.delta
          if (!delta) continue

          if (delta.reasoning_content) {
            reasoningText += delta.reasoning_content
          }
          if (delta.content) {
            content += delta.content
            onChunk(delta.content)
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const index = tc.index ?? 0
              const acc = toolAcc.get(index) ?? { arguments: '' }
              if (tc.id) acc.id = tc.id
              if (tc.function?.name) acc.name = tc.function.name
              if (tc.function?.arguments) acc.arguments += tc.function.arguments
              toolAcc.set(index, acc)
            }
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }

    logLlmReasoning(traceScope, providerId, model, reasoningText)

    const toolCalls: LlmToolCall[] = Array.from(toolAcc.entries())
      .sort(([a], [b]) => a - b)
      .map(([, acc]) => ({
        id: acc.id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
        name: acc.name ?? '',
        arguments: acc.arguments
      }))
      .filter((tc) => tc.name)

    return { content, toolCalls }
  }
}
