import type { TxtChapter } from './textChapters'

export type TxtBlockType = 'title' | 'subtitle' | 'heading' | 'paragraph' | 'blank'

export interface TxtFormattedBlock {
  type: TxtBlockType
  text: string
}

function classifyLine(line: string, lines: string[], index: number): TxtBlockType {
  if (/^(第[0-9一二三四五六七八九十百千]+[章节部分篇卷]|Chapter\s+\d+)/i.test(line)) {
    return 'title'
  }
  if (/^(\d+[.)．]\s*|[一二三四五六七八九十百千]+[、.)．]\s*)/.test(line) && line.length <= 48) {
    return 'heading'
  }
  const prevBlank = index === 0 || lines[index - 1].trim() === ''
  if (
    prevBlank &&
    line.length >= 2 &&
    line.length <= 28 &&
    !/[。！？.!?，,；;：:]$/.test(line) &&
    !/^\d/.test(line)
  ) {
    return 'subtitle'
  }
  return 'paragraph'
}

/** 将章节正文解析为带类型的块，便于阅读排版 */
export function formatChapterContent(chapterTitle: string, rawContent: string): TxtFormattedBlock[] {
  const lines = rawContent.split('\n')
  let startIdx = 0

  if (lines[0]?.trim() === chapterTitle.trim()) {
    startIdx = 1
  }
  while (startIdx < lines.length && lines[startIdx].trim() === '') {
    startIdx += 1
  }

  const blocks: TxtFormattedBlock[] = []
  for (let i = startIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) {
      blocks.push({ type: 'blank', text: '' })
      continue
    }
    blocks.push({ type: classifyLine(trimmed, lines, i), text: trimmed })
  }

  if (blocks.length === 0 && rawContent.trim()) {
    return [{ type: 'paragraph', text: rawContent.trim() }]
  }

  return blocks
}

export function isChapterTitleLike(text: string): boolean {
  const t = text.trim()
  return (
    /^(第[0-9一二三四五六七八九十百千]+[章节部分篇卷]|Chapter\s+\d+)/i.test(t) ||
    (/^(\d+[.)．]\s*|[一二三四五六七八九十]+[、.)．]\s*)/.test(t) && t.length <= 32)
  )
}

/** 缩略图摘要：跳过标题，取首段正文 */
export function getChapterThumbSnippet(chapter: TxtChapter, maxLen = 72): string {
  const blocks = formatChapterContent(chapter.title, chapter.content)
  const para = blocks.find((b) => b.type === 'paragraph')
  if (para) {
    return para.text.length > maxLen ? `${para.text.slice(0, maxLen)}…` : para.text
  }
  const heading = blocks.find((b) => b.type === 'heading' || b.type === 'subtitle')
  if (heading && heading.text !== chapter.title) {
    return heading.text
  }
  const trimmed = chapter.content.trim()
  if (trimmed.startsWith(chapter.title.trim())) {
    const rest = trimmed.slice(chapter.title.trim().length).trim()
    if (rest) return rest.length > maxLen ? `${rest.slice(0, maxLen)}…` : rest
  }
  return chapter.title.length > maxLen ? `${chapter.title.slice(0, maxLen)}…` : chapter.title
}
