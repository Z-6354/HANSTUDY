// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html
  }
}))

import {
  isBodyEmpty,
  slashCommandToVisualHtml,
  visualHtmlToNoteBody
} from '../src/renderer/src/features/notes/noteComposerContent'
import '../src/renderer/src/features/notes/noteSlashCommands.builtin'
import { slashCommandRegistry } from '../src/renderer/src/features/notes/noteSlashRegistry'

describe('noteComposerContent', () => {
  it('detects empty body', () => {
    expect(isBodyEmpty('')).toBe(true)
    expect(isBodyEmpty('   ')).toBe(true)
    expect(isBodyEmpty('**  **')).toBe(true)
    expect(isBodyEmpty('有内容')).toBe(false)
    expect(isBodyEmpty('<mark>高亮</mark>')).toBe(false)
  })

  it('serializes empty bold slash block as empty body (editing placeholder)', () => {
    const cmd = slashCommandRegistry.get('b')!
    const html = slashCommandToVisualHtml(cmd)
    expect(visualHtmlToNoteBody(html)).toBe('')
  })

  it('serializes bold slash block to markdown', () => {
    const cmd = slashCommandRegistry.get('b')!
    const html = slashCommandToVisualHtml(cmd).replace('\u200B', 'hello')
    expect(visualHtmlToNoteBody(html)).toBe('**hello**')
  })

  it('preserves inline color styles in output', () => {
    const html = '<span data-note-block="color" style="color: #e53935">red text</span>'
    const body = visualHtmlToNoteBody(html)
    expect(body).toContain('color: #e53935')
    expect(body).not.toContain('data-note-block')
  })

  it('preserves highlight mark styles in output', () => {
    const html = '<mark style="background-color: #fff59d">hi</mark>'
    const body = visualHtmlToNoteBody(html)
    expect(body).toContain('background-color: #fff59d')
  })

  it('serializes code block after esc exit', () => {
    const html = '<pre><code>const x = 1</code></pre>'
    expect(visualHtmlToNoteBody(html)).toContain('<pre><code>const x = 1</code></pre>')
  })

  it('skips caret anchor nodes when serializing', () => {
    const html =
      '<pre><code>code</code></pre><span class="doc-note-composer-caret-anchor">\u200B</span>'
    expect(visualHtmlToNoteBody(html)).toBe('<pre><code>code</code></pre>')
  })
})
