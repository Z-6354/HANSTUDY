import { describe, expect, it } from 'vitest'
import {
  wrapNoteFontSize,
  wrapNoteHighlight,
  wrapNoteTextColor
} from '../src/renderer/src/features/notes/noteComposerFormat'

describe('noteComposerFormat', () => {
  it('wraps empty selection without placeholder text', () => {
    expect(wrapNoteFontSize('14px', '')).toBe('<span style="font-size: 14px"></span>')
    expect(wrapNoteTextColor('#e53935', '')).toBe('<span style="color: #e53935"></span>')
    expect(wrapNoteHighlight('#fff59d', '')).toBe(
      '<mark style="background-color: #fff59d"></mark>'
    )
  })
})
