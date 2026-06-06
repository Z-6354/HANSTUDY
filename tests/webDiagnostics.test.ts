import { describe, expect, it } from 'vitest'
import { pushDebugEvent } from '../src/shared/webDiagnostics'

describe('webDiagnostics rules', () => {
  it('pushDebugEvent prepends timestamped line and caps length', () => {
    const first = pushDebugEvent([], 'event-a', 3)
    expect(first).toHaveLength(1)
    expect(first[0]).toContain('event-a')

    const capped = pushDebugEvent(['1', '2'], 'event-b', 2)
    expect(capped).toHaveLength(2)
    expect(capped[0]).toContain('event-b')
    expect(capped[1]).toBe('1')
  })
})
