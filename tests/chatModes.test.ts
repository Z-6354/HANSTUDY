import { describe, expect, it } from 'vitest'
import {
  estimateTokens,
  getContextWindowForModel,
  getSystemPromptForMode
} from '../src/shared/chatModes'

describe('chatModes rules', () => {
  it('getSystemPromptForMode returns mode-specific prompts', () => {
    expect(getSystemPromptForMode('chat')).toContain('文档阅读助手')
    expect(getSystemPromptForMode('agent')).toContain('阅读智能体')
    expect(getSystemPromptForMode('reading')).toContain('阅读助手')
    expect(getSystemPromptForMode('reading')).toContain('引用格式')
  })

  it('getContextWindowForModel falls back to default', () => {
    expect(getContextWindowForModel('deepseek-v4-flash')).toBe(128000)
    expect(getContextWindowForModel('unknown-model')).toBe(32000)
  })

  it('estimateTokens handles empty and non-empty text', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('abcd')).toBe(2)
  })
})
