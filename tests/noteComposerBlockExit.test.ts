// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  caretSlashBlockKind,
  exitSlashBlockEdit,
  findActiveSlashBlock,
  placeCaretInSlashBlock,
  trySlashBlockEscapeKey
} from '../src/renderer/src/features/notes/noteComposerSlashBlock'
import { NOTE_SLASH_COMMANDS } from '../src/renderer/src/features/notes/noteSlashCommands'
import { slashCommandToVisualHtml } from '../src/renderer/src/features/notes/noteComposerContent'

describe('composer block exit', () => {
  it('exits code block edit and places caret outside', () => {
    const root = document.createElement('div')
    root.contentEditable = 'true'
    const cmd = NOTE_SLASH_COMMANDS.find((c) => c.id === 'daima')!
    root.innerHTML = slashCommandToVisualHtml(cmd)
    document.body.appendChild(root)

    placeCaretInSlashBlock(root, cmd)
    expect(caretSlashBlockKind(root)).toBe('code')
    expect(findActiveSlashBlock(root)?.dataset.noteBlock).toBe('code')

    expect(exitSlashBlockEdit(root)).toBe(true)
    expect(caretSlashBlockKind(root)).toBeNull()
    expect(root.querySelector('pre[data-note-block="code"]')).toBeNull()
    expect(root.querySelector('.doc-note-composer-caret-anchor')).not.toBeNull()

    document.body.removeChild(root)
  })

  it('exits inline bold block without inserting a paragraph', () => {
    const root = document.createElement('div')
    root.contentEditable = 'true'
    const cmd = NOTE_SLASH_COMMANDS.find((c) => c.id === 'b')!
    root.innerHTML = `前缀${slashCommandToVisualHtml(cmd)}后缀`
    document.body.appendChild(root)

    placeCaretInSlashBlock(root, cmd)
    expect(caretSlashBlockKind(root)).toBe('bold')
    const strong = root.querySelector('strong[data-note-block="bold"]')
    expect(strong).not.toBeNull()

    expect(exitSlashBlockEdit(root)).toBe(true)
    expect(caretSlashBlockKind(root)).toBeNull()
    expect(root.querySelector('strong[data-note-block="bold"]')).toBeNull()
    expect(root.querySelector('.doc-note-composer-caret-anchor')).not.toBeNull()

    document.body.removeChild(root)
  })

  it('exits bold block on Escape key', () => {
    const root = document.createElement('div')
    root.contentEditable = 'true'
    const cmd = NOTE_SLASH_COMMANDS.find((c) => c.id === 'b')!
    root.innerHTML = slashCommandToVisualHtml(cmd)
    document.body.appendChild(root)

    placeCaretInSlashBlock(root, cmd)
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    expect(trySlashBlockEscapeKey(event, root)).toBe(true)
    expect(caretSlashBlockKind(root)).toBeNull()
    expect(root.querySelector('strong')).not.toBeNull()

    document.body.removeChild(root)
  })

  it('preserves bold when typing inside /b block', () => {
    const root = document.createElement('div')
    root.contentEditable = 'true'
    const cmd = NOTE_SLASH_COMMANDS.find((c) => c.id === 'b')!
    root.innerHTML = slashCommandToVisualHtml(cmd)
    document.body.appendChild(root)

    placeCaretInSlashBlock(root, cmd)
    const strong = root.querySelector('strong[data-note-block="bold"]')!
    const text = strong.firstChild as Text
    text.textContent = '加粗文字'

    expect(strong.textContent).toBe('加粗文字')
    expect(strong.tagName.toLowerCase()).toBe('strong')

    document.body.removeChild(root)
  })
})
