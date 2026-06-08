import { describe, expect, it } from 'vitest'
import {
  NoteSlashCommandRegistry,
  defaultCaretSelector,
  type NoteSlashCommand
} from '../src/renderer/src/features/notes/noteSlashRegistry'

describe('noteSlashRegistry', () => {
  it('registers and resolves commands', () => {
    const registry = new NoteSlashCommandRegistry()
    const cmd: NoteSlashCommand = {
      id: 'test',
      label: '/test',
      description: '测试',
      keywords: ['test', 't'],
      template: 'hello'
    }
    registry.register(cmd)
    expect(registry.get('test')).toEqual(cmd)
    expect(registry.resolveById('TEST')).toEqual(cmd)
    expect(registry.filter('t')).toEqual([cmd])
  })

  it('throws on duplicate id', () => {
    const registry = new NoteSlashCommandRegistry()
    const base: NoteSlashCommand = {
      id: 'dup',
      label: '/dup',
      description: 'a',
      keywords: ['dup'],
      template: 'a'
    }
    registry.register(base)
    expect(() => registry.register(base)).toThrow(/already registered/)
  })

  it('prioritizes exact id in filter', () => {
    const registry = new NoteSlashCommandRegistry()
    registry.registerMany([
      {
        id: 'liebiao',
        label: '/liebiao',
        description: '列表',
        keywords: ['liebiao', 'lb'],
        template: '- '
      },
      {
        id: 'b',
        label: '/b',
        description: '加粗',
        keywords: ['b', 'bold'],
        template: '**$CURSOR$**'
      }
    ])
    expect(registry.filter('b').map((c) => c.id)).toEqual(['b', 'liebiao'])
  })
})
