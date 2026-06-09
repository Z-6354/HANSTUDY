/** 工具审计日志条目（对齐 hancli AuditLog.AuditEntry） */

import { isMcpToolName } from './agent/tools'

export type AuditOutcome = 'allow' | 'deny' | 'error'

export type AuditApprover = 'none' | 'hitl' | 'policy' | 'mention'

export interface AuditEntry {
  timestamp: string
  tool: string
  args: string | null
  outcome: AuditOutcome
  reason: string | null
  approver: AuditApprover
  durationMs: number
}

export interface AuditLogInfo {
  auditDir: string
  todayFile: string
}

const MAX_FIELD_CHARS = 1000

export function shouldAuditTool(name: string): boolean {
  return (
    isMcpToolName(name) ||
    name.startsWith('read_') ||
    name.startsWith('search_') ||
    name.startsWith('list_') ||
    name.startsWith('get_') ||
    name.startsWith('load_') ||
    name.startsWith('parse_') ||
    name === 'glob_library'
  )
}

export function serializeToolArgs(args: Record<string, unknown> | undefined): string {
  try {
    return JSON.stringify(args ?? {})
  } catch {
    return '{}'
  }
}

export function sanitizeAuditField(value: string | null): string | null {
  if (value == null) return null
  let sanitized = value.replace(/Bearer\s+[^\s"'{}]+/gi, 'Bearer ***')
  sanitized = sanitized.replace(/\bAuthorization\s*:\s*[^\s,}]+/gi, 'Authorization: ***')
  sanitized = sanitized.replace(
    /("?(?:token|key|password|secret)"?\s*[:=]\s*")([^"]+)(")/gi,
    '$1***$3'
  )
  sanitized = sanitized.replace(
    /\b(token|key|password|secret)\b\s*[:=]\s*([^\s,}]+)/gi,
    '$1 ***'
  )
  return sanitized
}

function truncateField(value: string | null): string | null {
  if (value == null) return null
  const sanitized = sanitizeAuditField(value) ?? value
  return sanitized.length <= MAX_FIELD_CHARS
    ? sanitized
    : sanitized.slice(0, MAX_FIELD_CHARS) + '...(truncated)'
}

function buildEntry(
  tool: string,
  args: string | null,
  outcome: AuditOutcome,
  reason: string | null,
  approver: AuditApprover,
  durationMs: number
): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    tool,
    args: truncateField(args),
    outcome,
    reason: reason ? truncateField(reason) : null,
    approver,
    durationMs
  }
}

export function auditEntryAllow(tool: string, args: string, durationMs: number): AuditEntry {
  return buildEntry(tool, args, 'allow', null, 'none', durationMs)
}

export function auditEntryDenyByHitl(
  tool: string,
  args: string,
  reason: string,
  durationMs: number
): AuditEntry {
  return buildEntry(tool, args, 'deny', reason, 'hitl', durationMs)
}

export function auditEntryDenyByPolicy(
  tool: string,
  args: string,
  reason: string,
  durationMs: number
): AuditEntry {
  return buildEntry(tool, args, 'deny', reason, 'policy', durationMs)
}

export function auditEntryError(
  tool: string,
  args: string,
  reason: string,
  durationMs: number
): AuditEntry {
  return buildEntry(tool, args, 'error', reason, 'none', durationMs)
}

export function isPolicyDenyMessage(message: string): boolean {
  return message.includes('不在允许范围') || message.includes('策略')
}
