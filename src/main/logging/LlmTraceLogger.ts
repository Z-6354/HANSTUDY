import { inferProviderId } from '../../shared/aiProviders'
import { appLogger } from './AppFileLogger'

/** 记录模型 reasoning 轨迹（对齐 hancli LlmTraceLogger，不记录含图片的请求体） */
export function logLlmReasoning(
  scope: string,
  providerId: string,
  model: string,
  reasoningContent: string
): void {
  if (!reasoningContent.trim()) return
  const normalized = reasoningContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  appLogger.info(
    'llm-trace',
    `reasoning [${scope}] provider=${providerId} model=${model} chars=${normalized.length}\n${normalized}`
  )
}

export function resolveProviderLabel(baseUrl: string, provider?: string): string {
  return provider?.trim() || inferProviderId(baseUrl)
}
