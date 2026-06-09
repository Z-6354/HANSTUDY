import { describe, expect, it } from 'vitest'
import { formatLastReadTime } from '../src/renderer/src/utils/formatLastReadTime'

describe('formatLastReadTime', () => {
  const now = new Date('2026-06-09T15:00:00.000Z')

  it('formats recent reads', () => {
    expect(formatLastReadTime('2026-06-09T14:59:30.000Z', now)).toBe('刚刚')
    expect(formatLastReadTime('2026-06-09T14:30:00.000Z', now)).toMatch(/分钟前/)
  })

  it('formats yesterday and older', () => {
    expect(formatLastReadTime('2026-06-08T10:00:00.000Z', now)).toBe('昨天')
    expect(formatLastReadTime('2026-06-06T10:00:00.000Z', now)).toMatch(/天前/)
  })
})
