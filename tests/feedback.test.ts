import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FEEDBACK_API_URL,
  resolveFeedbackApiUrl,
  validateFeedbackPayload
} from '../src/shared/feedback'

describe('resolveFeedbackApiUrl', () => {
  it('uses default when env is empty', () => {
    expect(resolveFeedbackApiUrl('')).toBe(DEFAULT_FEEDBACK_API_URL)
    expect(resolveFeedbackApiUrl(undefined)).toBe(DEFAULT_FEEDBACK_API_URL)
  })

  it('strips trailing slashes from env override', () => {
    expect(resolveFeedbackApiUrl('https://example.com/')).toBe('https://example.com')
  })
})

describe('validateFeedbackPayload', () => {
  it('rejects empty title', () => {
    expect(
      validateFeedbackPayload({ category: 'bug', title: '  ', description: 'detail' })
    ).toBe('请填写标题')
  })

  it('rejects empty description', () => {
    expect(
      validateFeedbackPayload({ category: 'bug', title: '标题', description: '' })
    ).toBe('请填写详细描述')
  })

  it('accepts valid payload', () => {
    expect(
      validateFeedbackPayload({
        category: 'bug',
        title: '资料库无法关闭',
        description: '步骤…',
        contact: 'a@b.com'
      })
    ).toBeNull()
  })
})
