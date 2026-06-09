import { describe, expect, it } from 'vitest'
import {
  auditEntryAllow,
  auditEntryDenyByHitl,
  auditEntryError,
  sanitizeAuditField,
  shouldAuditTool
} from '../src/shared/auditLog'

describe('auditLog', () => {
  it('shouldAuditTool covers agent builtins and MCP', () => {
    expect(shouldAuditTool('list_library')).toBe(true)
    expect(shouldAuditTool('read_file')).toBe(true)
    expect(shouldAuditTool('mcp__foo__bar')).toBe(true)
    expect(shouldAuditTool('glob_library')).toBe(true)
    expect(shouldAuditTool('unknown_tool')).toBe(false)
  })

  it('sanitizeAuditField redacts bearer tokens and secrets', () => {
    const raw = 'Authorization: Bearer sk-secret123 and password: hunter2'
    const sanitized = sanitizeAuditField(raw)
    expect(sanitized).not.toContain('sk-secret123')
    expect(sanitized).not.toContain('hunter2')
    expect(sanitized).toContain('Authorization: ***')
    expect(sanitized).toContain('password ***')
  })

  it('auditEntryAllow has expected shape', () => {
    const entry = auditEntryAllow('list_library', '{"path":"."}', 12)
    expect(entry.tool).toBe('list_library')
    expect(entry.outcome).toBe('allow')
    expect(entry.approver).toBe('none')
    expect(entry.durationMs).toBe(12)
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('auditEntryDenyByHitl marks hitl approver', () => {
    const entry = auditEntryDenyByHitl('mcp__x__run', '{}', '用户拒绝', 5)
    expect(entry.outcome).toBe('deny')
    expect(entry.approver).toBe('hitl')
  })

  it('auditEntryError preserves reason', () => {
    const entry = auditEntryError('read_file', '{}', '文件不存在', 3)
    expect(entry.outcome).toBe('error')
    expect(entry.reason).toBe('文件不存在')
  })
})
