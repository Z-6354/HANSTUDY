export const MAX_AI_DOC_CONTEXT = 12_000

export interface ExtractedSection {
  content: string
  sectionTitle?: string
  truncated: boolean
}

/** Markdown：按当前行定位所在章节（最近的上级标题到同级下一标题） */
export function extractMdSection(full: string, lineNumber?: number): ExtractedSection {
  const lines = full.split('\n')
  const headings: Array<{ line: number; level: number; title: string }> = []

  lines.forEach((line, idx) => {
    const match = /^(#{1,6})\s+(.*)$/.exec(line)
    if (match) headings.push({ line: idx, level: match[1]!.length, title: match[2]!.trim() })
  })

  let start = 0
  let end = lines.length
  let sectionTitle: string | undefined

  if (lineNumber != null && lineNumber > 0) {
    const target = lineNumber - 1
    let active = -1
    for (let i = 0; i < headings.length; i++) {
      if (headings[i]!.line <= target) active = i
      else break
    }
    if (active >= 0) {
      const head = headings[active]!
      start = head.line
      sectionTitle = head.title
      for (let i = active + 1; i < headings.length; i++) {
        if (headings[i]!.level <= head.level) {
          end = headings[i]!.line
          break
        }
      }
    }
  } else if (headings.length > 0) {
    sectionTitle = headings[0]!.title
    start = headings[0]!.line
    for (let i = 1; i < headings.length; i++) {
      if (headings[i]!.level <= headings[0]!.level) {
        end = headings[i]!.line
        break
      }
    }
  }

  let content = lines.slice(start, end).join('\n').trim()
  if (sectionTitle) {
    content = `# ${sectionTitle}\n\n${content.replace(/^#{1,6}\s+.*\n?/, '')}`.trim()
  }

  const truncated = content.length > MAX_AI_DOC_CONTEXT
  if (truncated) {
    content = `${content.slice(0, MAX_AI_DOC_CONTEXT)}\n\n…（章节过长，已截断）`
  }
  return { content, sectionTitle, truncated }
}

/** 纯文本：以当前行或滚动比例为中心取窗口 */
export function extractTxtWindow(
  full: string,
  lineNumber?: number,
  scrollRatio?: number
): ExtractedSection {
  const lines = full.split('\n')
  const total = lines.length
  let center = 0
  if (lineNumber != null && lineNumber > 0) center = Math.min(total - 1, lineNumber - 1)
  else if (scrollRatio != null) center = Math.min(total - 1, Math.floor(scrollRatio * total))

  const half = 150
  const start = Math.max(0, center - half)
  const end = Math.min(total, center + half + 1)
  let content = lines.slice(start, end).join('\n')
  if (start > 0) content = `…（前略 ${start} 行）\n\n${content}`
  if (end < total) content += `\n\n…（后略 ${total - end} 行）`

  const truncated = content.length > MAX_AI_DOC_CONTEXT
  if (truncated) content = `${content.slice(0, MAX_AI_DOC_CONTEXT)}\n\n…（已截断）`
  return { content, sectionTitle: undefined, truncated }
}
