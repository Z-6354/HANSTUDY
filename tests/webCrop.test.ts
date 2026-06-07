import { describe, expect, it } from 'vitest'
import {
  buildSearchUrl,
  clampCrop,
  looksLikeUrl,
  normalizeWebUrl,
  resolveWebInput,
  webDisplayName,
  webUrlKey
} from '../src/shared/webCrop'

describe('webCrop rules', () => {
  it('clampCrop enforces minimum span', () => {
    expect(clampCrop({ left: 0.9, right: 0.95 })).toEqual({ left: 0.88, right: 1 })
  })

  it('clampCrop resets invalid range by swapping inverted bounds', () => {
    expect(clampCrop({ left: 0.8, right: 0.2 })).toEqual({ left: 0.2, right: 0.8 })
  })

  it('looksLikeUrl distinguishes url vs search query', () => {
    expect(looksLikeUrl('github.com')).toBe(true)
    expect(looksLikeUrl('https://example.com')).toBe(true)
    expect(looksLikeUrl('localhost:3000')).toBe(true)
    expect(looksLikeUrl('react 文档')).toBe(false)
    expect(looksLikeUrl('')).toBe(false)
  })

  it('normalizeWebUrl adds https and rejects non-http', () => {
    expect(normalizeWebUrl('www.baidu.com')).toBe('https://www.baidu.com/')
    expect(normalizeWebUrl('ftp://files.example.com')).toBeNull()
    expect(normalizeWebUrl('')).toBeNull()
  })

  it('resolveWebInput routes search keywords to engine', () => {
    expect(resolveWebInput('react hooks', 'bing')).toBe(
      'https://www.bing.com/search?q=react%20hooks'
    )
    expect(resolveWebInput('www.baidu.com', 'baidu')).toBe('https://www.baidu.com/')
  })

  it('buildSearchUrl supports engines', () => {
    expect(buildSearchUrl('测试', 'baidu')).toBe('https://www.baidu.com/s?wd=%E6%B5%8B%E8%AF%95')
    expect(buildSearchUrl('test', 'google')).toBe('https://www.google.com/search?q=test')
  })

  it('webDisplayName strips www', () => {
    expect(webDisplayName('https://www.example.com/path')).toBe('example.com')
  })

  it('webUrlKey normalizes trailing slash for matching', () => {
    expect(webUrlKey('https://example.com/page/')).toBe('https://example.com/page')
    expect(webUrlKey('https://example.com/page')).toBe('https://example.com/page')
    expect(webUrlKey('https://example.com/page#frag')).toBe('https://example.com/page')
  })
})
