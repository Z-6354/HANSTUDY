import { describe, expect, it } from 'vitest'
import { buildChatApiMessage, extractMessageText } from '../src/shared/chatPayload'

describe('buildChatApiMessage', () => {
  it('keeps plain text messages unchanged', () => {
    expect(buildChatApiMessage({ role: 'assistant', content: 'hello' })).toEqual({
      role: 'assistant',
      content: 'hello'
    })
  })

  it('builds multimodal payload for user images', () => {
    const result = buildChatApiMessage({
      role: 'user',
      content: '这是什么？',
      images: [{ id: '1', dataUrl: 'data:image/png;base64,abc' }]
    })
    expect(result.role).toBe('user')
    expect(Array.isArray(result.content)).toBe(true)
    expect(result.content).toEqual([
      { type: 'text', text: '这是什么？' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc', detail: 'auto' } }
    ])
  })

  it('adds fallback text when only images are sent', () => {
    const result = buildChatApiMessage({
      role: 'user',
      content: '',
      images: [{ id: '1', dataUrl: 'data:image/png;base64,abc' }]
    })
    expect(result.content).toEqual([
      { type: 'text', text: '请查看我发送的图片。' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc', detail: 'auto' } }
    ])
  })
})

describe('extractMessageText', () => {
  it('reads text from multimodal content', () => {
    expect(
      extractMessageText([
        { type: 'text', text: '看图' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }
      ])
    ).toBe('看图')
  })
})
