/** 将 glob 模式转为正则（对齐 hancli glob_files 语义） */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normalizeGlobPattern(pattern: string): string {
  let normalized = pattern.replace(/\\/g, '/').trim()
  if (!normalized) return '**/*'
  if (!normalized.includes('/') && !normalized.startsWith('**')) {
    return `**/${normalized}`
  }
  return normalized
}

export function globToRegExp(pattern: string): RegExp {
  const normalized = normalizeGlobPattern(pattern)
  let re = '^'
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]!
    if (ch === '*') {
      if (normalized[i + 1] === '*') {
        re += '.*'
        i++
        if (normalized[i + 1] === '/') i++
      } else {
        re += '[^/]*'
      }
    } else if (ch === '?') {
      re += '.'
    } else {
      re += escapeRegExp(ch)
    }
  }
  return new RegExp(`${re}$`, 'i')
}

export function matchGlob(pattern: string, targetPath: string): boolean {
  const normalized = targetPath.replace(/\\/g, '/')
  const regex = globToRegExp(pattern)
  return regex.test(normalized)
}
