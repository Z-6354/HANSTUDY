import { EDITABLE_BLOCK_PAD, slashCommandToVisualHtml } from './noteComposerContent'
import type { NoteSlashCommand } from './noteSlashCommands'

export type ComposerBlockKind = 'code' | 'heading' | 'quote' | 'list' | 'bold' | 'underline'

/** 光标是否位于 slash 插入的可编辑块内 */
export function caretComposerBlockKind(el: HTMLElement | null): ComposerBlockKind | null {
  const sel = window.getSelection()
  if (!sel?.anchorNode || !el) return null
  const anchor = sel.anchorNode
  const element =
    anchor.nodeType === Node.ELEMENT_NODE
      ? (anchor as HTMLElement)
      : anchor.parentElement
  if (!element || !el.contains(element)) return null

  if (element.closest('pre[data-note-block="code"]')) return 'code'
  if (element.closest('h2[data-note-block="heading"]')) return 'heading'
  if (element.closest('blockquote[data-note-block="quote"]')) return 'quote'
  if (element.closest('ul[data-note-block="list"]')) return 'list'
  if (element.closest('p[data-note-block="bold"]')) return 'bold'
  if (element.closest('p[data-note-block="underline"]')) return 'underline'
  return null
}

function caretTargetForBlock(cmd: NoteSlashCommand): string {
  switch (cmd.id) {
    case 'daima':
      return 'pre[data-note-block="code"] code'
    case 'biaoti':
      return 'h2[data-note-block="heading"]'
    case 'liebiao':
      return 'ul[data-note-block="list"] li'
    case 'yinyong':
      return 'blockquote[data-note-block="quote"] p'
    case 'jialuo':
      return 'p[data-note-block="bold"] strong'
    case 'xiahuaxian':
      return 'p[data-note-block="underline"] u'
    default:
      return '[data-note-block]'
  }
}

function ensureTextLeaf(node: Node, pad: string): Text {
  if (node.nodeType === Node.TEXT_NODE) return node as Text
  const el = node as HTMLElement
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const existing = walker.nextNode() as Text | null
  if (existing) return existing
  return el.appendChild(document.createTextNode(pad))
}

/** 将光标移入刚插入的预览块内部，便于直接输入 */
export function placeCaretInSlashBlock(root: HTMLElement, cmd: NoteSlashCommand): void {
  const sel = window.getSelection()
  if (!sel) return

  const selector = caretTargetForBlock(cmd)
  const targets = root.querySelectorAll(selector)
  const target = targets[targets.length - 1]
  if (!target) return

  const textNode = ensureTextLeaf(target, EDITABLE_BLOCK_PAD)
  const offset = textNode.textContent?.length ?? 0
  const range = document.createRange()
  range.setStart(textNode, offset)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
  root.focus()
}

export function findActiveComposerBlock(root: HTMLElement): HTMLElement | null {
  const sel = window.getSelection()
  if (!sel?.anchorNode || !root.contains(sel.anchorNode)) return null
  const anchor = sel.anchorNode
  const element =
    anchor.nodeType === Node.ELEMENT_NODE
      ? (anchor as HTMLElement)
      : anchor.parentElement
  return (element?.closest('[data-note-block]') as HTMLElement | null) ?? null
}

function ensureExitParagraphAfter(block: HTMLElement): HTMLElement {
  const next = block.nextElementSibling
  if (
    next instanceof HTMLParagraphElement &&
    !next.hasAttribute('data-note-block') &&
    !next.querySelector('[data-note-block]')
  ) {
    if (!next.textContent?.replace(/\u200B/g, '').length) {
      next.textContent = ''
      next.appendChild(document.createTextNode(EDITABLE_BLOCK_PAD))
    }
    return next
  }

  const p = document.createElement('p')
  p.className = 'doc-note-composer-exit-line'
  p.appendChild(document.createTextNode(EDITABLE_BLOCK_PAD))
  block.after(p)
  return p
}

function placeCaretInParagraph(p: HTMLElement, root: HTMLElement): void {
  const sel = window.getSelection()
  if (!sel) return
  const text =
    (p.firstChild?.nodeType === Node.TEXT_NODE
      ? (p.firstChild as Text)
      : p.appendChild(document.createTextNode(EDITABLE_BLOCK_PAD))) ?? null
  if (!text) return
  const range = document.createRange()
  range.setStart(text, text.textContent?.length ?? 0)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
  root.focus()
}

/** 退出当前预览块编辑：光标移到块外，可继续输入正文 */
export function exitComposerBlockEdit(root: HTMLElement): boolean {
  const block = findActiveComposerBlock(root)
  if (!block) return false
  const exitLine = ensureExitParagraphAfter(block)
  placeCaretInParagraph(exitLine, root)
  return true
}

/** 在 contenteditable 选区上应用富文本格式 */
export function focusEditor(el: HTMLElement | null): void {
  el?.focus()
}

export function execRichCommand(command: string, value?: string): boolean {
  try {
    return document.execCommand(command, false, value)
  } catch {
    return false
  }
}

const CURSOR_MARKER = '\u2060'

function restoreCursorFromMarker(sel: Selection, marker: string): void {
  const anchor = sel.anchorNode
  const root =
    anchor instanceof HTMLElement
      ? anchor.closest('[contenteditable]')
      : anchor?.parentElement?.closest('[contenteditable]')
  if (!root) return

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const text = node.textContent ?? ''
    const idx = text.indexOf(marker)
    if (idx < 0) continue
    node.textContent = text.slice(0, idx) + text.slice(idx + marker.length)
    const range = document.createRange()
    range.setStart(node, idx)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    return
  }
}

function selectedRangeHtml(range: Range): string {
  const fragment = range.extractContents()
  const temp = document.createElement('div')
  temp.appendChild(fragment)
  return temp.innerHTML || temp.textContent || ''
}

export function wrapSelectionHtml(open: string, close: string): void {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)

  if (range.collapsed) {
    document.execCommand('insertHTML', false, `${open}${CURSOR_MARKER}${close}`)
    restoreCursorFromMarker(sel, CURSOR_MARKER)
    return
  }

  const selected = selectedRangeHtml(range)
  document.execCommand('insertHTML', false, `${open}${selected}${close}`)
}

export function applyBold(): void {
  execRichCommand('bold')
}

export function applyUnderline(): void {
  execRichCommand('underline')
}

export function applyTextColor(color: string): void {
  if (!color) {
    execRichCommand('removeFormat')
    return
  }
  wrapSelectionHtml(`<span style="color: ${color}">`, '</span>')
}

export function applyHighlight(color: string): void {
  wrapSelectionHtml(`<mark style="background-color: ${color}">`, '</mark>')
}

export function applyFontSize(size: string): void {
  wrapSelectionHtml(`<span style="font-size: ${size}">`, '</span>')
}

export function insertPlainText(el: HTMLElement, text: string): void {
  el.focus()
  document.execCommand('insertText', false, text)
}

export function textBeforeCursor(el: HTMLElement): string {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return ''
  const range = sel.getRangeAt(0)
  if (!el.contains(range.startContainer)) return ''
  const pre = range.cloneRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.startContainer, range.startOffset)
  return pre.toString()
}

function findSlashReplaceRange(
  el: HTMLElement,
  slashStart: number,
  replaceEnd: number
): Range | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  const pre = range.cloneRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.startContainer, range.startOffset)
  const before = pre.toString()
  const endChars = replaceEnd ?? before.length
  if (slashStart < 0 || slashStart > endChars) return null

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let chars = 0
  let startNode: Text | null = null
  let startOff = 0
  let endNode: Text | null = null
  let endOff = 0

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const len = node.length
    if (!startNode && chars + len > slashStart) {
      startNode = node
      startOff = slashStart - chars
    }
    if (!endNode && chars + len >= endChars) {
      endNode = node
      endOff = endChars - chars
      break
    }
    chars += len
  }

  if (!startNode || !endNode) return null

  const replaceRange = document.createRange()
  replaceRange.setStart(startNode, startOff)
  replaceRange.setEnd(endNode, endOff)
  return replaceRange
}

/** 可视化模式：插入渲染后的块（非 ``` 等 MD 源码） */
export function replaceSlashCommandVisual(
  el: HTMLElement,
  slashStart: number,
  cmd: NoteSlashCommand,
  replaceEnd?: number
): void {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  const range = sel.getRangeAt(0)
  const pre = range.cloneRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.startContainer, range.startOffset)
  const endChars = replaceEnd ?? pre.toString().length

  const visualHtml = slashCommandToVisualHtml(cmd)
  const replaceRange = findSlashReplaceRange(el, slashStart, endChars)

  el.focus()

  if (!replaceRange) {
    document.execCommand('insertHTML', false, visualHtml)
    requestAnimationFrame(() => placeCaretInSlashBlock(el, cmd))
    return
  }

  replaceRange.deleteContents()
  const fragment = replaceRange.createContextualFragment(visualHtml)
  replaceRange.insertNode(fragment)
  requestAnimationFrame(() => placeCaretInSlashBlock(el, cmd))
}

export function replaceSlashCommand(
  el: HTMLElement,
  slashStart: number,
  template: string,
  replaceEnd?: number
): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return template.length
  const range = sel.getRangeAt(0)
  const pre = range.cloneRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.startContainer, range.startOffset)
  const endChars = replaceEnd ?? pre.toString().length
  if (slashStart < 0 || slashStart > endChars) return template.length

  const replaceRange = findSlashReplaceRange(el, slashStart, endChars)

  if (!replaceRange) {
    insertPlainText(el, template)
    return template.indexOf('$CURSOR$') >= 0 ? template.indexOf('$CURSOR$') : template.length
  }

  replaceRange.deleteContents()
  const cursorMarker = '\u200B'
  const withMarker = template.replace('$CURSOR$', cursorMarker)
  const textNode = document.createTextNode(withMarker)
  replaceRange.insertNode(textNode)

  const cursorPos = withMarker.indexOf(cursorMarker)
  if (cursorPos >= 0 && textNode.parentNode) {
    const newRange = document.createRange()
    newRange.setStart(textNode, cursorPos)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
    textNode.textContent = withMarker.replace(cursorMarker, '')
  }

  return cursorPos >= 0 ? cursorPos : withMarker.length
}
