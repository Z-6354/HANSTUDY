import { describe, expect, it } from 'vitest'
import { isBodyEmpty } from '../src/renderer/src/features/notes/noteComposerContent'

describe('noteComposerContent', () => {
  it('detects empty body', () => {
    expect(isBodyEmpty('')).toBe(true)
    expect(isBodyEmpty('   ')).toBe(true)
    expect(isBodyEmpty('**  **')).toBe(true)
    expect(isBodyEmpty('有内容')).toBe(false)
    expect(isBodyEmpty('<mark>高亮</mark>')).toBe(false)
  })
})
