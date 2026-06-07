import { parseTxtOutline, type TextOutlineItem } from './textOutline'

export interface TxtChapter {
  id: number
  title: string
  startLine: number
  endLine: number
  content: string
}

export function buildTxtChapters(content: string): TxtChapter[] {
  if (!content) {
    return [{ id: 1, title: '全文', startLine: 1, endLine: 1, content: '' }]
  }

  const lines = content.split('\n')
  const outline = parseTxtOutline(content)

  if (outline.length === 0) {
    return splitByBlankBlocks(lines)
  }

  const chapters: TxtChapter[] = []
  for (let i = 0; i < outline.length; i++) {
    const start = outline[i].line
    const end = i + 1 < outline.length ? outline[i + 1].line - 1 : lines.length
    chapters.push({
      id: i + 1,
      title: outline[i].title,
      startLine: start,
      endLine: Math.max(start, end),
      content: lines.slice(start - 1, end).join('\n')
    })
  }
  return chapters
}

function splitByBlankBlocks(lines: string[]): TxtChapter[] {
  const blocks: { start: number; end: number }[] = []
  let blockStart = 0
  let inBlock = false

  for (let i = 0; i < lines.length; i++) {
    const blank = lines[i].trim() === ''
    if (!blank && !inBlock) {
      blockStart = i
      inBlock = true
    } else if (blank && inBlock) {
      blocks.push({ start: blockStart, end: i - 1 })
      inBlock = false
    }
  }
  if (inBlock) blocks.push({ start: blockStart, end: lines.length - 1 })

  if (blocks.length === 0) {
    return [
      {
        id: 1,
        title: '全文',
        startLine: 1,
        endLine: lines.length,
        content: lines.join('\n')
      }
    ]
  }

  return blocks.map((block, index) => {
    const slice = lines.slice(block.start, block.end + 1)
    const firstLine = slice.find((l) => l.trim())?.trim() ?? `章节 ${index + 1}`
    const title = firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine
    return {
      id: index + 1,
      title,
      startLine: block.start + 1,
      endLine: block.end + 1,
      content: slice.join('\n')
    }
  })
}

export function chapterIndexForLine(chapters: TxtChapter[], line: number): number {
  const idx = chapters.findIndex((c) => line >= c.startLine && line <= c.endLine)
  return idx >= 0 ? idx : 0
}

export function outlineItemsFromChapters(chapters: TxtChapter[]): TextOutlineItem[] {
  return chapters.map((c) => ({
    title: c.title,
    line: c.startLine,
    level: 0,
    children: []
  }))
}
