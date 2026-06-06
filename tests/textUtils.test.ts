import { describe, expect, it } from 'vitest'
import { offsetToRange, rangeToOffsets } from '../src/renderer/src/features/reader/annotations/textUtils'

describe('textUtils offset rules', () => {
  const sample = 'line1\nline2\nline3'

  it('offsetToRange maps byte offsets to line/column', () => {
    expect(offsetToRange(sample, 0, 5)).toEqual({
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 6,
      startOffset: 0,
      endOffset: 5
    })
    expect(offsetToRange(sample, 6, 11)).toMatchObject({
      startLine: 2,
      startColumn: 1,
      endLine: 2,
      endColumn: 6
    })
  })

  it('rangeToOffsets round-trips with stored offsets', () => {
    const range = offsetToRange(sample, 6, 11)
    expect(rangeToOffsets(sample, range)).toEqual({ start: 6, end: 11 })
  })

  it('rangeToOffsets computes from line/column when offsets absent', () => {
    expect(
      rangeToOffsets(sample, {
        startLine: 3,
        startColumn: 1,
        endLine: 3,
        endColumn: 6
      })
    ).toEqual({ start: 12, end: 17 })
  })
})
