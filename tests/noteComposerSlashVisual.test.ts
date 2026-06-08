// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { slashCommandToVisualHtml } from '../src/renderer/src/features/notes/noteComposerContent'
import { NOTE_SLASH_COMMANDS } from '../src/renderer/src/features/notes/noteSlashCommands'

describe('noteComposerContent slash visual', () => {
  it.each(NOTE_SLASH_COMMANDS)('renders /$id as preview HTML without MD markers', (cmd) => {
    const html = slashCommandToVisualHtml(cmd)
    expect(html).not.toContain('```')
    expect(html).not.toContain('## ')
    if (cmd.id === 'daima') {
      expect(html).toMatch(/<pre[\s>][\s\S]*data-note-block="code"[\s\S]*<code[\s>]/i)
    }
    if (cmd.id === 'biaoti') {
      expect(html).toMatch(/<h2[\s>]/i)
    }
    if (cmd.id === 'liebiao') {
      expect(html).toMatch(/<ul[\s>][\s\S]*<li[\s>]/i)
    }
    if (cmd.id === 'yinyong') {
      expect(html).toMatch(/<blockquote[\s>]/i)
    }
    if (cmd.id === 'jialuo' || cmd.id === 'b') {
      expect(html).toMatch(/<strong[\s>][\s\S]*data-note-block="bold"/i)
    }
    if (cmd.id === 'xiahuaxian') {
      expect(html).toMatch(/<u[\s>][\s\S]*data-note-block="underline"/i)
    }
    if (cmd.id === 'red') {
      expect(html).toMatch(/data-note-block="color"/i)
      expect(html).toMatch(/color:\s*#e53935/i)
    }
  })
})
