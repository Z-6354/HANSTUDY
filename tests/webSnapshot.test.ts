import { describe, expect, it } from 'vitest'
import { formatWebSnapshotTabTitle, isWebSnapshotPdfPath } from '../src/shared/webSnapshot'

describe('webSnapshot rules', () => {
  it('isWebSnapshotPdfPath matches userData layout', () => {
    expect(isWebSnapshotPdfPath('C:/Users/x/AppData/data/web-snapshots/abc/page.pdf')).toBe(
      true
    )
    expect(isWebSnapshotPdfPath('/data/web-snapshots/uuid/page.pdf')).toBe(true)
    expect(isWebSnapshotPdfPath('D:/books/paper.pdf')).toBe(false)
  })

  it('formatWebSnapshotTabTitle adds prefix once', () => {
    expect(formatWebSnapshotTabTitle('百度首页')).toBe('[网页] 百度首页')
    expect(formatWebSnapshotTabTitle('[网页] 已有')).toBe('[网页] 已有')
    expect(formatWebSnapshotTabTitle('  ')).toBe('[网页] 网页快照')
  })
})
