import { marked } from 'marked'
import { sanitizeNoteHtml } from './noteHtmlSanitize'

marked.setOptions({ gfm: true, breaks: true })

export function renderNoteMarkdownHtml(markdown: string): string {
  const raw = marked.parse(markdown || '') as string
  return sanitizeNoteHtml(raw)
}
