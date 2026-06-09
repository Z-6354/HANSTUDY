import { describe, expect, it } from 'vitest'
import { mergeChatContextItems } from '../src/shared/aiContext'
import {
  CITATION_FORMAT_EXAMPLES,
  formatDocumentContextHeader,
  formatReadingProgressHint,
  getReadingUnderstandingRules
} from '../src/shared/readingAssistant'
import { getSystemPromptForMode } from '../src/shared/chatModes'

describe('readingAssistant', () => {
  it('includes citation and inference rules', () => {
    const rules = getReadingUnderstandingRules({ withTools: false })
    expect(rules).toContain('推断')
    expect(rules).toContain(CITATION_FORMAT_EXAMPLES[0])
  })

  it('formatDocumentContextHeader includes hint', () => {
    expect(formatDocumentContextHeader('a.pdf', '第 2 页')).toContain('a.pdf')
    expect(formatDocumentContextHeader('a.pdf', '第 2 页')).toContain('第 2 页')
  })

  it('formatReadingProgressHint prefers pdf page', () => {
    expect(formatReadingProgressHint({ pdfPage: 5 })).toBe('第 5 页')
    expect(formatReadingProgressHint({ monacoLine: 10, sectionTitle: '导论' })).toBe(
      '章节：导论 · L10'
    )
  })
})

describe('chatModes reading/agent prompts', () => {
  it('reading prompt includes understanding rules', () => {
    const prompt = getSystemPromptForMode('reading')
    expect(prompt).toContain('阅读助手')
    expect(prompt).toContain('引用格式')
  })

  it('agent prompt includes tool guidance', () => {
    const prompt = getSystemPromptForMode('agent')
    expect(prompt).toContain('list_library')
    expect(prompt).toContain('推断')
  })
})

describe('mergeChatContextItems citation headers', () => {
  it('embeds structured headers for documents', () => {
    const merged = mergeChatContextItems([
      {
        id: '1',
        kind: 'document',
        label: 'paper.pdf',
        content: 'body',
        hint: '第 1 页',
        docPath: 'D:/lib/paper.pdf'
      }
    ])
    expect(merged?.content).toContain('paper.pdf')
    expect(merged?.content).toContain('第 1 页')
    expect(merged?.docPath).toBe('D:/lib/paper.pdf')
  })
})
