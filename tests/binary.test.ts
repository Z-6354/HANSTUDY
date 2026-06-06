import { describe, expect, it } from 'vitest'
import { toUint8Array } from '../src/shared/binary'

describe('toUint8Array', () => {
  it('passes through Uint8Array', () => {
    const input = new Uint8Array([1, 2, 3])
    expect(toUint8Array(input)).toBe(input)
  })

  it('wraps ArrayBuffer', () => {
    const buf = new Uint8Array([4, 5]).buffer
    const out = toUint8Array(buf)
    expect(Array.from(out)).toEqual([4, 5])
  })

  it('converts legacy number[]', () => {
    expect(Array.from(toUint8Array([7, 8, 9]))).toEqual([7, 8, 9])
  })
})
