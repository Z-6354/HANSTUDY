/** OpenAI function 参数 schema 辅助（对齐 hancli ToolRegistry.createParameters） */

export interface ToolParamDef {
  name: string
  type: 'string' | 'integer' | 'boolean'
  description: string
  required?: boolean
}

export function createToolParameters(params: ToolParamDef[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const p of params) {
    properties[p.name] = { type: p.type, description: p.description }
    if (p.required) required.push(p.name)
  }
  const schema: Record<string, unknown> = { type: 'object', properties }
  if (required.length) schema.required = required
  return schema
}

export function parseIntArg(value: unknown, fallback: number): number {
  if (value == null || value === '') return fallback
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(n) ? n : fallback
}

export function parseBooleanArg(value: unknown, fallback: boolean): boolean {
  if (value == null || value === '') return fallback
  const s = String(value).trim().toLowerCase()
  if (s === 'true' || s === '1' || s === 'yes') return true
  if (s === 'false' || s === '0' || s === 'no') return false
  return fallback
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
