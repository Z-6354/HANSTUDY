import { EDITABLE_BLOCK_PAD, slashCommandToVisualHtml } from './noteComposerContent'
import { placeCaretInSlashBlock } from './noteComposerSlashBlock'
import {
  isInlineSlashKind,
  type NoteSlashCommand
} from './noteSlashRegistry'

export type { ComposerBlockKind } from './noteComposerSlashBlock'
export {
  caretComposerBlockKind,
  caretSlashBlockKind,
  exitComposerBlockEdit,
  exitSlashBlockEdit,
  findActiveComposerBlock,
  findActiveSlashBlock,
  isSlashBlockEditing,
  placeCaretInSlashBlock,
  trySlashBlockEscapeKey
} from './noteComposerSlashBlock'

function collapseSelectionToEnd(replaceRange: Range, sel: Selection): void {
  replaceRange.collapse(false)
  sel.removeAllRanges()
  sel.addRange(replaceRange)
}

function getContentEditableRoot(from: Node | null): HTMLElement | null {
  if (!from) return null
  const el =
    from.nodeType === Node.ELEMENT_NODE ? (from as HTMLElement) : from.parentElement
  const root = el?.closest('[contenteditable="true"], [contenteditable=""]') as HTMLElement | null
  return root?.isContentEditable ? root : null
}

function tryExecInsertHtml(root: HTMLElement | null, html: string): boolean {
  if (!root || typeof document.execCommand !== 'function') return false
  try {
    return document.execCommand('insertHTML', false, html)
  } catch {
    return false
  }
}

function insertHtmlAtSelection(html: string): void {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const root = getContentEditableRoot(range.commonAncestorContainer)
  if (root) root.focus()
  if (tryExecInsertHtml(root, html)) return

  const fragment = range.createContextualFragment(html)
  const last = fragment.lastChild
  range.insertNode(fragment)
  if (last) {
    range.setStartAfter(last)
    range.collapse(true)
  } else {
    range.collapse(false)
  }
  sel.removeAllRanges()
  sel.addRange(range)
}

function replaceRangeWithHtml(range: Range, html: string): void {
  const sel = window.getSelection()
  if (!sel) return
  const next = range.cloneRange()
  next.deleteContents()
  const root = getContentEditableRoot(next.commonAncestorContainer)
  if (root) root.focus()
  sel.removeAllRanges()
  sel.addRange(next)
  if (tryExecInsertHtml(root, html)) return

  const fragment = next.createContextualFragment(html)
  const last = fragment.lastChild
  next.insertNode(fragment)
  if (last) {
    next.setStartAfter(last)
    next.collapse(true)
  } else {
    next.collapse(false)
  }
  sel.removeAllRanges()
  sel.addRange(next)
}

function applyInlineSlashHtml(cmd: NoteSlashCommand, pad: string): void {
  const html = cmd.buildVisualHtml?.(pad) ?? slashCommandToVisualHtml(cmd)
  insertHtmlAtSelection(html)
}

/** 行内 slash：优先 execCommand（Chromium），否则回退 insertHTML */
function applyInlineSlashVisual(
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

  const replaceRange = findSlashReplaceRange(el, slashStart, endChars)
  if (replaceRange) {
    replaceRange.deleteContents()
    collapseSelectionToEnd(replaceRange, sel)
  }

  el.focus()
  const pad = EDITABLE_BLOCK_PAD

  switch (cmd.blockKind) {
    case 'bold':
    case 'underline':
    case 'color':
      applyInlineSlashHtml(cmd, pad)
      break
    default:
      insertHtmlAtSelection(slashCommandToVisualHtml(cmd))
  }

  requestAnimationFrame(() => placeCaretInSlashBlock(el, cmd))
}

/** 在 contenteditable 选区上应用富文本格式 */
export function focusEditor(el: HTMLElement | null): void {
  el?.focus()
}

/** 恢复编辑器选区（工具栏/颜色菜单点击前调用） */
export function restoreComposerSelection(root: HTMLElement, saved: Range | null): boolean {
  if (!saved) return false
  const anchor = saved.commonAncestorContainer
  if (!root.contains(anchor)) return false
  const sel = window.getSelection()
  if (!sel) return false
  sel.removeAllRanges()
  sel.addRange(saved)
  root.focus()
  return true
}

export function execRichCommand(command: string, value?: string): boolean {
  try {
    return document.execCommand(command, false, value)
  } catch {
    return false
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
    replaceRangeWithHtml(range, `${open}${EDITABLE_BLOCK_PAD}${close}`)
    return
  }

  const selected = selectedRangeHtml(range)
  replaceRangeWithHtml(range, `${open}${selected}${close}`)
}

export function applyBold(): void {
  wrapSelectionHtml('<strong>', '</strong>')
}

export function applyUnderline(): void {
  wrapSelectionHtml('<u>', '</u>')
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
  if (cmd.blockKind && isInlineSlashKind(cmd.blockKind)) {
    applyInlineSlashVisual(el, slashStart, cmd, replaceEnd)
    return
  }

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
