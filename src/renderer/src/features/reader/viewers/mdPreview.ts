import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { parseMdOutline } from './textOutline'

marked.setOptions({ gfm: true, breaks: true })

export function buildMdPreviewHtml(content: string): string {
  const outline = parseMdOutline(content)
  let headingIndex = 0
  const raw = marked.parse(content) as string
  const withIds = raw.replace(/<h([1-6])([^>]*)>/g, (_match, depth: string, attrs: string) => {
    const item = outline[headingIndex++]
    const line = item?.line ?? headingIndex
    return `<h${depth}${attrs} id="outline-line-${line}" data-line="${line}">`
  })
  return DOMPurify.sanitize(withIds)
}
