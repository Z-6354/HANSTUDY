import DOMPurify from 'dompurify'

/** 笔记正文（MD + 内联 HTML）允许的 tag / attr */
export const NOTE_HTML_ALLOWED_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  'mark',
  'span',
  'br',
  'p',
  'div',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a'
]

export const NOTE_HTML_ALLOWED_ATTR = ['style', 'href', 'target', 'rel', 'data-note-block']

export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: NOTE_HTML_ALLOWED_TAGS,
    ALLOWED_ATTR: NOTE_HTML_ALLOWED_ATTR
  })
}
