import { describe, expect, it } from 'vitest'
import {
  NOTE_SLASH_COMMANDS,
  isSlashCommandAnchor,
  parseSlashAtCursor,
  resolveSlashCommand,
  trySlashCompleteOnSpace
} from '../src/renderer/src/features/notes/noteSlashCommands'

describe('noteSlashCommands', () => {
  it('parses slash command in middle of text', () => {
    const cmd = NOTE_SLASH_COMMANDS[0]!
    const before = `前缀文字/${cmd.id}`
    expect(parseSlashAtCursor(before)).toEqual({
      slashStart: 4,
      query: cmd.id
    })
  })

  it('ignores URL slashes', () => {
    expect(parseSlashAtCursor('见 https://a.com')).toBeNull()
  })

  it('ignores numeric fractions', () => {
    expect(isSlashCommandAnchor('1/2', 1)).toBe(false)
  })

  it.each(NOTE_SLASH_COMMANDS.map((cmd) => [cmd.id] as const))(
    'auto-applies on space when id is complete: /%s ',
    (id) => {
      const prefix = '任意位置'
      const result = trySlashCompleteOnSpace(`${prefix}/${id} `)
      expect(result?.command.id).toBe(id)
      expect(result?.slashStart).toBe(prefix.length)
    }
  )

  it('does not auto-apply partial id or keyword alias on space', () => {
    const full = NOTE_SLASH_COMMANDS[0]!
    const partial = full.id.slice(0, Math.max(1, full.id.length - 1))
    const alias = full.keywords.find((kw) => kw !== full.id)
    expect(trySlashCompleteOnSpace(`/${partial} `)).toBeNull()
    if (alias) {
      expect(trySlashCompleteOnSpace(`/${alias} `)).toBeNull()
    }
  })

  it.each(NOTE_SLASH_COMMANDS.map((cmd) => [cmd.id] as const))(
    'resolveSlashCommand matches only full id: %s',
    (id) => {
      expect(resolveSlashCommand(id)?.id).toBe(id)
    }
  )
})
