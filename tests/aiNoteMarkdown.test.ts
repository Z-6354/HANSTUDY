import { describe, expect, it } from 'vitest'
import {
  findPrecedingUserMessage,
  formatAiExchangeNoteMarkdown,
  formatAiSessionNoteMarkdown,
  isAiNoteAnchor
} from '../src/shared/aiNoteMarkdown'

describe('isAiNoteAnchor', () => {
  it('detects AI note anchors', () => {
    expect(isAiNoteAnchor('__hanstudy_ai__')).toBe(true)
    expect(isAiNoteAnchor('/doc.md', 'session-1')).toBe(true)
    expect(isAiNoteAnchor('/doc.md')).toBe(false)
  })
})

describe('formatAiExchangeNoteMarkdown', () => {
  it('includes question and answer sections', () => {
    const md = formatAiExchangeNoteMarkdown({
      sessionTitle: '测试对话',
      question: '什么是 React？',
      answer: 'React 是一个 UI 库。',
      contextLabels: ['笔记 · readme.md · L.10']
    })
    expect(md).toContain('## 测试对话')
    expect(md).toContain('### 问')
    expect(md).toContain('什么是 React？')
    expect(md).toContain('### 答')
    expect(md).toContain('React 是一个 UI 库')
    expect(md).toContain('> 引用：笔记 · readme.md · L.10')
  })
})

describe('formatAiSessionNoteMarkdown', () => {
  it('formats full session with Q/A pairs', () => {
    const md = formatAiSessionNoteMarkdown(
      [
        {
          id: '1',
          role: 'user',
          content: '第一问',
          createdAt: '2026-01-01T00:00:00.000Z'
        },
        {
          id: '2',
          role: 'assistant',
          content: '第一答',
          createdAt: '2026-01-01T00:00:01.000Z'
        },
        {
          id: '3',
          role: 'user',
          content: '第二问',
          createdAt: '2026-01-01T00:00:02.000Z'
        },
        {
          id: '4',
          role: 'assistant',
          content: '第二答',
          createdAt: '2026-01-01T00:00:03.000Z'
        }
      ],
      '历史对话'
    )
    expect(md).toContain('第一问')
    expect(md).toContain('第一答')
    expect(md).toContain('第二问')
    expect(md).toContain('第二答')
    expect(md).toContain('---')
  })
})

describe('findPrecedingUserMessage', () => {
  it('finds the nearest user message before assistant reply', () => {
    const messages = [
      { id: 'u1', role: 'user' as const, content: '旧问题', createdAt: '' },
      { id: 'a1', role: 'assistant' as const, content: '旧回答', createdAt: '' },
      { id: 'u2', role: 'user' as const, content: '新问题', createdAt: '' },
      { id: 'a2', role: 'assistant' as const, content: '新回答', createdAt: '' }
    ]
    expect(findPrecedingUserMessage(messages, 'a2')?.content).toBe('新问题')
  })
})
