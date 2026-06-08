// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  caretComposerBlockKind,
  exitComposerBlockEdit,
  findActiveComposerBlock,
  placeCaretInSlashBlock
} from '../src/renderer/src/features/notes/noteComposerRich'
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
    expect(caretComposerBlockKind(root)).toBe('code')
    expect(findActiveComposerBlock(root)?.dataset.noteBlock).toBe('code')

    expect(exitComposerBlockEdit(root)).toBe(true)
    expect(caretComposerBlockKind(root)).toBeNull()
    expect(root.querySelector('.doc-note-composer-exit-line')).not.toBeNull()

    document.body.removeChild(root)
  })
})
