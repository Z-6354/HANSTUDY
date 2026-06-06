import { describe, expect, it } from 'vitest'
import {
  credentialsOriginMatch,
  formatPhoneDisplay,
  isRecordableWebUrl,
  normalizePhoneNumber,
  webDisplayTitle
} from '../src/shared/webLibrary'

describe('webLibrary rules', () => {
  it('isRecordableWebUrl filters blank and non-http', () => {
    expect(isRecordableWebUrl('https://example.com')).toBe(true)
    expect(isRecordableWebUrl('about:blank')).toBe(false)
    expect(isRecordableWebUrl('file:///tmp/x')).toBe(false)
    expect(isRecordableWebUrl('')).toBe(false)
  })

  it('normalizePhoneNumber accepts CN mobile and +86', () => {
    expect(normalizePhoneNumber('138 0013 8000')).toBe('13800138000')
    expect(normalizePhoneNumber('+86 13800138000')).toBe('13800138000')
    expect(normalizePhoneNumber('abc')).toBeNull()
    expect(normalizePhoneNumber('12345')).toBeNull()
  })

  it('formatPhoneDisplay groups CN mobile', () => {
    expect(formatPhoneDisplay('13800138000')).toBe('138 0013 8000')
    expect(formatPhoneDisplay('1234567')).toBe('1234567')
  })

  it('credentialsOriginMatch allows subdomain and rejects unrelated hosts', () => {
    expect(credentialsOriginMatch('https://example.com', 'https://login.example.com')).toBe(true)
    expect(credentialsOriginMatch('https://login.example.com', 'https://example.com')).toBe(true)
    expect(credentialsOriginMatch('https://example.com', 'https://notexample.com')).toBe(false)
    expect(credentialsOriginMatch('https://example.com', 'https://xa.com')).toBe(false)
  })

  it('webDisplayTitle falls back to hostname', () => {
    expect(webDisplayTitle('', 'https://docs.github.com')).toBe('docs.github.com')
    expect(webDisplayTitle('GitHub Docs', 'https://docs.github.com')).toBe('GitHub Docs')
  })
})
