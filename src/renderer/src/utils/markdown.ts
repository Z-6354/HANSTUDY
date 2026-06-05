import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

export function renderMarkdownHtml(content: string): string {
  if (!content.trim()) return ''
  return DOMPurify.sanitize(marked.parse(content) as string)
}
