import DOMPurify from 'dompurify'
import { renderNoteMarkdownHtml } from './noteMarkdown'
import type { NoteSlashCommand } from './noteSlashCommands'

const ALLOWED_TAGS = [
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

const VISUAL_CURSOR_MARKER = '\u2060'
/** 占位以保证空块内可放置光标；序列化时剔除 */
export const EDITABLE_BLOCK_PAD = '\u200B'

/** slash 命令 → 可视化块 HTML（不经过 ``` / ## 等 MD 符号） */
export function slashCommandToVisualHtml(cmd: NoteSlashCommand): string {
  const pad = EDITABLE_BLOCK_PAD
  switch (cmd.id) {
    case 'daima':
      return `<pre data-note-block="code"><code>${pad}</code></pre>`
    case 'biaoti':
      return `<h2 data-note-block="heading">${pad}</h2>`
    case 'liebiao':
      return `<ul data-note-block="list"><li>${pad}</li></ul>`
    case 'yinyong':
      return `<blockquote data-note-block="quote"><p>${pad}</p></blockquote>`
    case 'jialuo':
      return `<p data-note-block="bold"><strong>${pad}</strong></p>`
    case 'xiahuaxian':
      return `<p data-note-block="underline"><u>${pad}</u></p>`
    default:
      return renderNoteMarkdownHtml(cmd.template.replace('$CURSOR$', ' '))
  }
}

/** 将笔记正文（MD + 内联 HTML）渲染为可视化编辑 HTML */
export function noteBodyToVisualHtml(body: string): string {
  if (!body.trim()) return ''
  return renderNoteMarkdownHtml(body)
}

/** 将可视化编辑区 HTML 序列化为可存储的正文 */
export function visualHtmlToNoteBody(html: string): string {
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS })
  const div = document.createElement('div')
  div.innerHTML = clean
  return serializeChildren(div.childNodes).replace(/\n{3,}/g, '\n\n').trim()
}

function serializeChildren(nodes: NodeListOf<ChildNode> | Iterable<ChildNode>): string {
  let out = ''
  for (const node of Array.from(nodes)) {
    out += serializeNode(node)
  }
  return out
}

function normalizeEditableText(text: string): string {
  return text.replace(/\u200B/g, '')
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeEditableText(node.textContent ?? '')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const inner = serializeChildren(el.childNodes)

  switch (tag) {
    case 'br':
      return '\n'
    case 'p':
    case 'div':
      return `${inner}\n`
    case 'b':
    case 'strong':
      return inner ? `**${inner}**` : ''
    case 'i':
    case 'em':
      return inner ? `*${inner}*` : ''
    case 'u':
    case 'mark':
    case 'span':
    case 'code':
    case 'pre':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'blockquote':
    case 'a':
      return el.outerHTML
    case 'ul':
    case 'ol':
      return `${inner}\n`
    case 'li':
      return `- ${inner.trim()}\n`
    default:
      return inner
  }
}

export function isBodyEmpty(body: string): boolean {
  const stripped = body
    .replace(/\u200B/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`#>\-\[\]]/g, '')
    .trim()
  return stripped.length === 0
}
