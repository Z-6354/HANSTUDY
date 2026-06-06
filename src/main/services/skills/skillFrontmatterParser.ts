export interface SkillFrontmatterParseResult {
  frontmatter: Record<string, unknown>
  body: string
  warnings: string[]
}

export function parseSkillFrontmatter(fullText: string): SkillFrontmatterParseResult {
  if (fullText == null) {
    return { frontmatter: {}, body: '', warnings: ['SKILL.md 内容为 null'] }
  }

  const normalized = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return { frontmatter: {}, body: normalized, warnings: ['缺少 frontmatter 起始标记 ---'] }
  }

  const endIdx = findFrontmatterEnd(normalized)
  if (endIdx < 0) {
    return { frontmatter: {}, body: normalized, warnings: ['缺少 frontmatter 结束标记 ---'] }
  }

  const frontmatterText = normalized.slice(4, endIdx)
  let body = normalized.slice(endIdx + 4)
  if (body.startsWith('\n')) {
    body = body.slice(1)
  }

  const warnings: string[] = []
  const frontmatter = parseFrontmatterBlock(frontmatterText, warnings)
  return { frontmatter, body, warnings }
}

function findFrontmatterEnd(text: string): number {
  let idx = 4
  while (idx < text.length) {
    const lineEnd = text.indexOf('\n', idx)
    if (lineEnd < 0) return -1
    const line = text.slice(idx, lineEnd)
    if (line === '---') return idx
    idx = lineEnd + 1
  }
  return -1
}

function parseFrontmatterBlock(text: string, warnings: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim() || line.trim().startsWith('#')) {
      i++
      continue
    }

    const colonIdx = findKeyColonIndex(line)
    if (colonIdx < 0) {
      warnings.push(`无法解析的 frontmatter 行: ${line}`)
      i++
      continue
    }

    const key = line.slice(0, colonIdx).trim()
    const rawValue = line.slice(colonIdx + 1).trim()

    if (!key) {
      warnings.push(`frontmatter 行缺少 key: ${line}`)
      i++
      continue
    }

    if (!rawValue) {
      warnings.push(`frontmatter 字段 '${key}' 缺少值或使用了不支持的嵌套结构`)
      i++
      continue
    }

    if (rawValue.startsWith('{')) {
      warnings.push(`frontmatter 字段 '${key}' 使用了不支持的嵌套对象语法`)
      i++
      continue
    }

    if (rawValue === '|' || rawValue.startsWith('|')) {
      const sb: string[] = []
      i++
      let baseIndent: number | null = null
      while (i < lines.length) {
        const next = lines[i]
        if (!next.trim()) {
          sb.push('')
          i++
          continue
        }
        const indent = leadingSpaces(next)
        if (indent === 0) break
        if (baseIndent == null) baseIndent = indent
        if (indent < baseIndent) break
        sb.push(next.slice(baseIndent))
        i++
      }
      result[key] = sb.join(' ').replace(/\s+/g, ' ').trim()
      continue
    }

    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const inner = rawValue.slice(1, -1).trim()
      const items: string[] = []
      if (inner) {
        for (const part of inner.split(',')) {
          let trimmed = part.trim()
          if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
            trimmed = trimmed.slice(1, -1)
          } else if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
            trimmed = trimmed.slice(1, -1)
          }
          if (trimmed) items.push(trimmed)
        }
      }
      result[key] = items
      i++
      continue
    }

    let value = rawValue
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1)
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1)
    }
    result[key] = value
    i++
  }

  return result
}

function findKeyColonIndex(line: string): number {
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === "'" && !inDouble) inSingle = !inSingle
    else if (c === '"' && !inSingle) inDouble = !inDouble
    else if (c === ':' && !inSingle && !inDouble) return i
  }
  return -1
}

function leadingSpaces(s: string): number {
  let i = 0
  while (i < s.length && s[i] === ' ') i++
  return i
}

export function stringField(fm: Record<string, unknown>, key: string): string | undefined {
  const v = fm[key]
  return typeof v === 'string' ? v : undefined
}

export function listField(fm: Record<string, unknown>, key: string): string[] {
  const v = fm[key]
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}
