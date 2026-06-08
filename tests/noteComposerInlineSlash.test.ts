// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html
  }
}))

import { visualHtmlToNoteBody } from '../src/renderer/src/features/notes/noteComposerContent'
import { replaceSlashCommandVisual } from '../src/renderer/src/features/notes/noteComposerRich'
import { resolveSlashCommand } from '../src/renderer/src/features/notes/noteSlashCommands'

describe('inline slash visual apply', () => {
  it('applies /b as strong with data-note-block', () => {
    const root = document.createElement('div')
    root.contentEditable = 'true'
    root.textContent = '/b '
    document.body.appendChild(root)

    const cmd = resolveSlashCommand('b')!
    const sel = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(root)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)

    replaceSlashCommandVisual(root, 0, cmd, 3)

    const strong = root.querySelector('strong[data-note-block="bold"]')
    expect(strong).not.toBeNull()

    document.body.removeChild(root)
  })

  it('keeps /b strong in DOM after sync would yield empty body', () => {
    const root = document.createElement('div')
    root.contentEditable = 'true'
    root.textContent = '/b '
    document.body.appendChild(root)

    const cmd = resolveSlashCommand('b')!
    const sel = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(root)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)

    replaceSlashCommandVisual(root, 0, cmd, 3)
    expect(visualHtmlToNoteBody(root.innerHTML)).toBe('')

    const strong = root.querySelector('strong[data-note-block="bold"]')
    expect(strong).not.toBeNull()

    const text = strong!.firstChild as Text
    text.textContent = '加粗'
    expect(visualHtmlToNoteBody(root.innerHTML)).toBe('**加粗**')

    document.body.removeChild(root)
  })
})