import { EDITABLE_BLOCK_PAD } from './noteComposerContent'
import {
  defaultCaretSelector,
  type NoteSlashBlockKind,
  type NoteSlashCommand
} from './noteSlashRegistry'

export type ComposerBlockKind = NoteSlashBlockKind

/** 光标是否位于 slash 插入的可编辑块内 */
export function isSlashBlockEditing(el: HTMLElement | null): boolean {
  return caretSlashBlockKind(el) != null
}

export function caretSlashBlockKind(el: HTMLElement | null): ComposerBlockKind | null {
  const sel = window.getSelection()
  if (!sel?.anchorNode || !el) return null
  const anchor = sel.anchorNode
  const element =
    anchor.nodeType === Node.ELEMENT_NODE
      ? (anchor as HTMLElement)
      : anchor.parentElement
  if (!element || !el.contains(element)) return null

  const block = element.closest('[data-note-block]')
  if (!block) return null
  const kind = block.getAttribute('data-note-block')
  if (!kind) return null
  return kind as ComposerBlockKind
}

export function findActiveSlashBlock(root: HTMLElement): HTMLElement | null {
  const sel = window.getSelection()
  if (!sel?.anchorNode || !root.contains(sel.anchorNode)) return null
  const anchor = sel.anchorNode
  const element =
    anchor.nodeType === Node.ELEMENT_NODE
      ? (anchor as HTMLElement)
      : anchor.parentElement
  return (element?.closest('[data-note-block]') as HTMLElement | null) ?? null
}

function ensureTextLeaf(node: Node, pad: string): Text {
  if (node.nodeType === Node.TEXT_NODE) return node as Text
  const el = node as HTMLElement
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const existing = walker.nextNode() as Text | null
  if (existing) return existing
  return el.appendChild(document.createTextNode(pad))
}

/** 将光标移入刚插入的 slash 块内部，便于直接输入 */
export function placeCaretInSlashBlock(root: HTMLElement, cmd: NoteSlashCommand): void {
  const sel = window.getSelection()
  if (!sel) return

  const selector = cmd.caretSelector ?? defaultCaretSelector(cmd)
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

function ensureInlineCaretAnchorAfter(block: HTMLElement): HTMLElement {
  const next = block.nextElementSibling
  if (next instanceof HTMLElement && next.classList.contains('doc-note-composer-caret-anchor')) {
    if (next.firstChild?.nodeType !== Node.TEXT_NODE) {
      next.textContent = ''
      next.appendChild(document.createTextNode(EDITABLE_BLOCK_PAD))
    }
    return next
  }
  const span = document.createElement('span')
  span.className = 'doc-note-composer-caret-anchor'
  span.appendChild(document.createTextNode(EDITABLE_BLOCK_PAD))
  block.after(span)
  return span
}

function placeCaretInTextNode(text: Text, root: HTMLElement, atEnd = true): void {
  const sel = window.getSelection()
  if (!sel) return
  const offset = atEnd ? (text.textContent?.length ?? 0) : 0
  const range = document.createRange()
  range.setStart(text, offset)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
  root.focus()
}

function placeCaretInAnchor(anchor: HTMLElement, root: HTMLElement): void {
  const text = anchor.firstChild
  if (text?.nodeType === Node.TEXT_NODE) {
    placeCaretInTextNode(text as Text, root)
    return
  }
  const pad = anchor.appendChild(document.createTextNode(EDITABLE_BLOCK_PAD))
  placeCaretInTextNode(pad, root)
}

function placeCaretAfterInlineBlock(block: HTMLElement, root: HTMLElement): void {
  const anchor = ensureInlineCaretAnchorAfter(block)
  placeCaretInAnchor(anchor, root)
}

/**
 * 退出当前 slash 块编辑：清除 data-note-block 并移出光标。
 * 适用于 /daima、/b、/red 等所有带 data-note-block 的命令。
 */
export function exitSlashBlockEdit(root: HTMLElement): boolean {
  const block = findActiveSlashBlock(root)
  if (!block) return false

  block.removeAttribute('data-note-block')

  const place = (): void => {
    placeCaretAfterInlineBlock(block, root)
  }

  place()
  requestAnimationFrame(place)
  return true
}

/**
 * Esc 退出 slash 块编辑（capture 阶段调用，优先于 slash 菜单关闭）。
 * @returns 是否已处理 Esc
 */
export function trySlashBlockEscapeKey(e: KeyboardEvent, root: HTMLElement | null): boolean {
  if (e.key !== 'Escape' || e.defaultPrevented || !root) return false
  if (!exitSlashBlockEdit(root)) return false
  e.preventDefault()
  e.stopImmediatePropagation()
  return true
}

/** @deprecated 使用 isSlashBlockEditing */
export const isComposerSlashBlockEditing = isSlashBlockEditing

/** @deprecated 使用 caretSlashBlockKind */
export const caretComposerBlockKind = caretSlashBlockKind

/** @deprecated 使用 findActiveSlashBlock */
export const findActiveComposerBlock = findActiveSlashBlock

/** @deprecated 使用 exitSlashBlockEdit */
export const exitComposerBlockEdit = exitSlashBlockEdit
