import { describe, expect, it } from 'vitest'
import { formatToolDisplayName } from '../src/shared/agent/tools'
import { localLogDayStamp } from '../src/shared/logDayStamp'

describe('localLogDayStamp', () => {
  it('uses local calendar date not UTC', () => {
    const d = new Date(2026, 5, 9, 23, 30, 0)
    expect(localLogDayStamp(d)).toBe('2026-06-09')
  })
})

describe('formatToolDisplayName', () => {
  it('maps builtin tools to Chinese labels', () => {
    expect(formatToolDisplayName('parse_pdf')).toBe('解析 PDF')
    expect(formatToolDisplayName('glob_library')).toBe('查找文件')
  })

  it('formats MCP tool names', () => {
    expect(formatToolDisplayName('mcp__server__run')).toBe('MCP · server/run')
  })
})
