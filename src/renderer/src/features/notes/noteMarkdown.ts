import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: true })

export function renderNoteMarkdownHtml(markdown: string): string {
  const raw = marked.parse(markdown || '') as string
  return DOMPurify.sanitize(raw)
}
