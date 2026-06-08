import { describe, expect, it } from 'vitest'
import {
  contrastTextForBackground,
  wrapNoteFontSize,
  wrapNoteHighlight,
  wrapNoteTextColor
} from '../src/renderer/src/features/notes/noteComposerFormat'

describe('noteComposerFormat', () => {
  it('picks readable text on highlight backgrounds', () => {
    expect(contrastTextForBackground('#fff176')).toBe('#212121')
    expect(contrastTextForBackground('#212121')).toBe('#fafafa')
  })

  it('wraps empty selection without placeholder text', () => {
    expect(wrapNoteFontSize('14px', '')).toBe('<span style="font-size: 14px"></span>')
    expect(wrapNoteTextColor('#c62828', '')).toBe('<span style="color: #c62828"></span>')
    expect(wrapNoteHighlight('#fff176', '')).toBe(
      '<mark style="background-color: #fff176; color: #212121"></mark>'
    )
  })
})
