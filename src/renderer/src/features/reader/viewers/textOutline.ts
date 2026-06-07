export interface TextOutlineItem {
  title: string
  /** 1-based line number */
  line: number
  level: number
  children: TextOutlineItem[]
}

export function parseMdOutline(content: string): TextOutlineItem[] {
  const lines = content.split('\n')
  const items: TextOutlineItem[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.+)$/.exec(lines[i])
    if (!m) continue
    items.push({
      title: m[2].trim(),
      line: i + 1,
      level: m[1].length - 1,
      children: []
    })
  }
  return items
}

export function parseTxtOutline(content: string): TextOutlineItem[] {
  const lines = content.split('\n')
  const items: TextOutlineItem[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const prevBlank = i === 0 || lines[i - 1].trim() === ''
    const isNumbered = /^(\d+[.)]\s|[一二三四五六七八九十]+[、.)]\s*)/.test(line)
    const isChapter = /^(第[0-9一二三四五六七八九十百千]+[章节部分篇]|Chapter\s+\d+)/i.test(line)
    const isShortTitle =
      prevBlank && line.length >= 2 && line.length <= 48 && !/[。！？.!?]$/.test(line)

    if (isNumbered || isChapter || isShortTitle) {
      items.push({
        title: line.length > 56 ? `${line.slice(0, 56)}…` : line,
        line: i + 1,
        level: isChapter || isNumbered ? 0 : 1,
        children: []
      })
    }
  }

  if (items.length === 0 && lines.some((l) => l.trim())) {
    return splitByBlankBlocksForOutline(lines)
  }

  return items
}

function splitByBlankBlocksForOutline(lines: string[]): TextOutlineItem[] {
  const items: TextOutlineItem[] = []
  let blockStart = 0
  let inBlock = false
  let chapterNo = 0

  for (let i = 0; i < lines.length; i++) {
    const blank = lines[i].trim() === ''
    if (!blank && !inBlock) {
      blockStart = i
      inBlock = true
    } else if (blank && inBlock) {
      chapterNo += 1
      const first = lines[blockStart].trim()
      items.push({
        title: first.length > 48 ? `${first.slice(0, 48)}…` : first || `章节 ${chapterNo}`,
        line: blockStart + 1,
        level: 0,
        children: []
      })
      inBlock = false
    }
  }
  if (inBlock) {
    chapterNo += 1
    const first = lines[blockStart].trim()
    items.push({
      title: first.length > 48 ? `${first.slice(0, 48)}…` : first || `章节 ${chapterNo}`,
      line: blockStart + 1,
      level: 0,
      children: []
    })
  }
  return items
}

export function flattenTextOutline(items: TextOutlineItem[]): TextOutlineItem[] {
  return items
}
