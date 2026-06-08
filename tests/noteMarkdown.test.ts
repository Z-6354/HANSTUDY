// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { renderNoteMarkdownHtml } from '../src/renderer/src/features/notes/noteMarkdown'

describe('noteMarkdown inline html', () => {
  it('preserves span color and mark highlight in preview html', () => {
    const html = renderNoteMarkdownHtml(
      '前缀<span style="color: #e53935">红色</span>后缀 <mark style="background-color: #fff59d">高亮</mark>'
    )
    expect(html).toContain('color: #e53935')
    expect(html).toContain('background-color: #fff59d')
  })

  it('renders bold markdown', () => {
    const html = renderNoteMarkdownHtml('**加粗**')
    expect(html).toMatch(/<strong[\s>]/)
  })
})
