import type { Annotation, TextRange } from '@shared/types'
import { resolveStoredMarkupColor, FALLBACK_HIGHLIGHT } from './annotationMarkup'
import { findPdfTextRangeInTextLayer } from './pdfTextSelection'
import { toolUsesRightClickUndo } from './annotationToolUtils'
import { useWorkspaceStore } from '../../../stores/workspaceStore'

function applyMarkupStyle(
  el: HTMLElement,
  type: 'highlight' | 'underline',
  color?: string
): void {
  if (type === 'highlight') {
    el.style.backgroundColor = color ?? FALLBACK_HIGHLIGHT
  } else {
    el.style.textDecoration = 'underline'
    el.style.textDecorationColor = color ?? '#007acc'
    el.style.textDecorationThickness = '2px'
  }
}

export function offsetToRange(text: string, startOffset: number, endOffset: number): TextRange {
  const compute = (offset: number): { line: number; column: number } => {
    let line = 1
    let column = 1
    for (let i = 0; i < text.length && i < offset; i++) {
      if (text[i] === '\n') {
        line++
        column = 1
      } else {
        column++
      }
    }
    return { line, column }
  }
  const start = compute(startOffset)
  const end = compute(endOffset)
  return {
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column,
    startOffset,
    endOffset
  }
}

export function rangeToOffsets(text: string, range: TextRange): { start: number; end: number } {
  if (range.startOffset != null && range.endOffset != null) {
    return { start: range.startOffset, end: range.endOffset }
  }
  const lines = text.split('\n')
  let offset = 0
  let start = 0
  let end = 0
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    if (lineNo === range.startLine) {
      start = offset + range.startColumn - 1
    }
    if (lineNo === range.endLine) {
      end = offset + range.endColumn - 1
    }
    offset += lines[i].length + 1
  }
  return { start, end }
}

interface TextSegment {
  node: Text
  start: number
}

function collectTextSegments(root: HTMLElement): { fullText: string; segments: TextSegment[] } {
  const segments: TextSegment[] = []
  let fullText = ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (
        parent?.closest('mark.annotation-highlight, u.annotation-underline') ||
        parent?.closest('script, style')
      ) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    }
  })
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? ''
    if (!text) continue
    segments.push({ node: node as Text, start: fullText.length })
    fullText += text
  }
  return { fullText, segments }
}

function locateTextOffset(segments: TextSegment[], offset: number): { node: Text; offset: number } | null {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const nextStart = i + 1 < segments.length ? segments[i + 1].start : Number.POSITIVE_INFINITY
    const len = nextStart - seg.start
    if (offset >= seg.start && offset < nextStart) {
      return { node: seg.node, offset: offset - seg.start }
    }
    if (offset === nextStart && i + 1 < segments.length) {
      return { node: segments[i + 1].node, offset: 0 }
    }
  }
  const last = segments[segments.length - 1]
  if (!last) return null
  const endOffset = offset - last.start
  if (endOffset >= 0 && endOffset <= (last.node.textContent?.length ?? 0)) {
    return { node: last.node, offset: endOffset }
  }
  return null
}

function rangeFromTextOffsets(
  segments: TextSegment[],
  start: number,
  end: number
): Range | null {
  const startPos = locateTextOffset(segments, start)
  const endPos = locateTextOffset(segments, end)
  if (!startPos || !endPos) return null
  const range = document.createRange()
  range.setStart(startPos.node, startPos.offset)
  range.setEnd(endPos.node, endPos.offset)
  return range
}

function searchTextVariants(text: string): string[] {
  const variants = new Set<string>()
  variants.add(text)
  variants.add(text.replace(/\r\n/g, '\n'))
  if (!text.includes('\n')) {
    variants.add(text.replace(/\s+/g, ' ').trim())
    variants.add(text.replace(/\n+/g, ''))
    variants.add(text.replace(/\s+/g, ''))
  } else {
    variants.add(
      text
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .join('\n')
    )
  }
  return Array.from(variants).filter((v) => v.length > 0)
}

export function findTextRangeInRoot(root: HTMLElement, selectedText: string): Range | null {
  if (!selectedText.trim()) return null
  const textLayer = root.querySelector('.textLayer')
  if (textLayer instanceof HTMLElement) {
    const pdfRange = findPdfTextRangeInTextLayer(textLayer, selectedText)
    if (pdfRange) return pdfRange
  }
  const { fullText, segments } = collectTextSegments(root)
  if (!segments.length) return null
  for (const attempt of searchTextVariants(selectedText)) {
    const index = fullText.indexOf(attempt)
    if (index === -1) continue
    const range = rangeFromTextOffsets(segments, index, index + attempt.length)
    if (range && !range.collapsed) return range
  }
  return null
}

function rangeTextSegments(
  range: Range
): Array<{ node: Text; start: number; end: number }> {
  const root =
    range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : (range.commonAncestorContainer as HTMLElement)
  if (!root) return []

  const segments: Array<{ node: Text; start: number; end: number }> = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT
      const parent = node.parentElement
      if (parent?.closest('mark.annotation-highlight, u.annotation-underline')) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    }
  })

  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node as Text
    let start = 0
    let end = text.length
    if (node === range.startContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
      start = range.startOffset
    }
    if (node === range.endContainer && range.endContainer.nodeType === Node.TEXT_NODE) {
      end = range.endOffset
    }
    if (start < end) segments.push({ node: text, start, end })
  }
  return segments
}

export function wrapRangeWithMarkup(
  range: Range,
  tagName: 'mark' | 'u',
  className: string,
  color?: string
): boolean {
  if (range.collapsed) return false
  const segments = rangeTextSegments(range)
  if (segments.length === 0) {
    const el = document.createElement(tagName)
    el.className = className
    applyMarkupStyle(el, tagName === 'mark' ? 'highlight' : 'underline', color)
    try {
      range.surroundContents(el)
      return true
    } catch {
      try {
        const fragment = range.extractContents()
        el.appendChild(fragment)
        range.insertNode(el)
        return true
      } catch {
        return false
      }
    }
  }

  for (let i = segments.length - 1; i >= 0; i--) {
    const { node, start, end } = segments[i]
    const sub = document.createRange()
    sub.setStart(node, start)
    sub.setEnd(node, end)
    const el = document.createElement(tagName)
    el.className = className
    applyMarkupStyle(el, tagName === 'mark' ? 'highlight' : 'underline', color)
    try {
      sub.surroundContents(el)
    } catch {
      try {
        const fragment = sub.extractContents()
        el.appendChild(fragment)
        sub.insertNode(el)
      } catch {
        return false
      }
    }
  }
  return true
}

function clearPdfSpanMarkup(root: HTMLElement): void {
  root.querySelectorAll('.textLayer span.annotation-highlight, .textLayer span.annotation-underline').forEach(
    (span) => {
      const el = span as HTMLElement
      el.classList.remove('annotation-highlight', 'annotation-underline')
      el.style.backgroundColor = ''
      el.style.textDecoration = ''
      el.style.textDecorationColor = ''
      el.style.textDecorationThickness = ''
    }
  )
}

function applyPdfSpanMarkup(
  root: HTMLElement,
  range: Range,
  type: 'highlight' | 'underline',
  className: string,
  color?: string
): boolean {
  const spans: HTMLElement[] = []
  root.querySelectorAll('.textLayer span').forEach((el) => {
    try {
      if (range.intersectsNode(el)) spans.push(el as HTMLElement)
    } catch {
      // stale range
    }
  })
  if (spans.length === 0) return false

  for (const span of spans) {
    span.classList.add(className)
    applyMarkupStyle(span, type, color)
  }
  return true
}

function rootHasPdfTextLayer(root: HTMLElement): boolean {
  return root.classList.contains('pdf-page-wrap') || root.querySelector('.textLayer') != null
}

export function applyTextMarkup(
  root: HTMLElement,
  selectedText: string,
  className: string,
  tagName: 'mark' | 'u' = 'mark',
  color?: string
): boolean {
  if (!selectedText.trim()) return false
  const domRange = findTextRangeInRoot(root, selectedText)
  if (domRange) {
    return wrapRangeWithMarkup(domRange, tagName, className, color)
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? ''
    const index = text.indexOf(selectedText)
    if (index === -1) continue
    const range = document.createRange()
    range.setStart(node, index)
    range.setEnd(node, index + selectedText.length)
    return wrapRangeWithMarkup(range, tagName, className, color)
  }
  return false
}

export function applyTextHighlights(root: HTMLElement, selectedText: string, className: string): void {
  applyTextMarkup(root, selectedText, className, 'mark')
}

export function applyDomAnnotation(
  root: HTMLElement,
  type: 'highlight' | 'underline',
  selectedText: string,
  domRange?: Range | null,
  color?: string
): boolean {
  const tag = type === 'highlight' ? 'mark' : 'u'
  const cls = type === 'highlight' ? 'annotation-highlight' : 'annotation-underline'
  const range =
    domRange && root.contains(domRange.commonAncestorContainer)
      ? domRange.cloneRange()
      : findTextRangeInRoot(root, selectedText)

  if (range && !range.collapsed && rootHasPdfTextLayer(root)) {
    if (applyPdfSpanMarkup(root, range, type, cls, color)) return true
  }
  if (range && !range.collapsed && wrapRangeWithMarkup(range, tag, cls, color)) return true
  return applyTextMarkup(root, selectedText, cls, tag, color)
}

export function applyStoredDomAnnotations(root: HTMLElement, annotations: Annotation[]): void {
  for (const a of annotations) {
    if (!a.selectedText) continue
    const color = resolveStoredMarkupColor(a)
    if (a.type === 'highlight') {
      applyTextMarkup(root, a.selectedText, 'annotation-highlight', 'mark', color)
    } else if (a.type === 'underline') {
      applyTextMarkup(root, a.selectedText, 'annotation-underline', 'u', color)
    }
  }
}

function unwrapMarkupElement(el: Element): void {
  const parent = el.parentNode
  if (!parent) return
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el)
  }
  parent.removeChild(el)
  parent.normalize()
}

/** ?? DOM ?????/?????????????? */
export function clearTextMarkup(root: HTMLElement): void {
  root.querySelectorAll('mark.annotation-highlight, u.annotation-underline').forEach(unwrapMarkupElement)
  clearPdfSpanMarkup(root)
}

/** ???????? DOM ???? */
export function refreshTextMarkup(root: HTMLElement, annotations: Annotation[]): void {
  clearTextMarkup(root)
  applyStoredDomAnnotations(
    root,
    annotations.filter(
      (a) => (a.type === 'highlight' || a.type === 'underline') && a.selectedText
    )
  )
}

export function findLastTextMarkupAnnotation(
  annotations: Annotation[],
  type: 'highlight' | 'underline'
): Annotation | undefined {
  return [...annotations].reverse().find((a) => a.type === type && a.selectedText)
}

const MARKUP_HIT_SELECTOR =
  'mark.annotation-highlight, u.annotation-underline, .textLayer span.annotation-highlight, .textLayer span.annotation-underline, .monaco-editor .view-line span.annotation-highlight, .monaco-editor .view-line span.annotation-underline'

function isOverlayHitTarget(el: Element): boolean {
  return !!el.closest('.annotation-overlay-layer, .annotation-overlay-mount')
}

function markupClassForElement(el: HTMLElement): 'annotation-highlight' | 'annotation-underline' | null {
  if (el.classList.contains('annotation-highlight') || el.tagName === 'MARK') {
    return 'annotation-highlight'
  }
  if (el.classList.contains('annotation-underline') || el.tagName === 'U') {
    return 'annotation-underline'
  }
  return null
}

function isMarkupClassElement(el: Element, cls: string): boolean {
  return (
    el instanceof HTMLElement &&
    (el.classList.contains(cls) ||
      (cls === 'annotation-highlight' && el.tagName === 'MARK') ||
      (cls === 'annotation-underline' && el.tagName === 'U'))
  )
}

function expandMarkupText(el: HTMLElement): string {
  const cls = markupClassForElement(el)
  if (!cls) return el.textContent ?? ''
  if (el.tagName === 'MARK' || el.tagName === 'U') return el.textContent ?? ''

  const parent = el.parentElement
  if (!parent) return el.textContent ?? ''

  const siblings = Array.from(parent.children)
  const idx = siblings.indexOf(el)
  if (idx < 0) return el.textContent ?? ''

  let text = ''
  for (let i = idx; i >= 0; i--) {
    const s = siblings[i]
    if (!isMarkupClassElement(s, cls)) break
    text = (s.textContent ?? '') + text
  }
  for (let i = idx + 1; i < siblings.length; i++) {
    const s = siblings[i]
    if (!isMarkupClassElement(s, cls)) break
    text += s.textContent ?? ''
  }
  return text
}

export function normalizeMarkupFragment(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** 根据 DOM 片段文本匹配高亮/下划线标注（逆序取最近一条） */
export function matchMarkupAnnotation(
  annotations: Annotation[],
  fragment: string
): Annotation | undefined {
  const norm = normalizeMarkupFragment(fragment)
  if (!norm) return undefined

  const candidates = [...annotations]
    .reverse()
    .filter((a) => (a.type === 'highlight' || a.type === 'underline') && a.selectedText)

  for (const a of candidates) {
    const sel = normalizeMarkupFragment(a.selectedText!)
    const exact = sel === norm
    const fragmentInSelection = sel.includes(norm) && norm.length >= 2
    const selectionInFragment = norm.includes(sel) && sel.length >= 2
    if (exact || fragmentInSelection || selectionInFragment) return a
  }

  return undefined
}

function collectElementsAtPoint(doc: Document, clientX: number, clientY: number): Element[] {
  if (typeof doc.elementsFromPoint === 'function') {
    return doc.elementsFromPoint(clientX, clientY)
  }
  const hit = doc.elementFromPoint(clientX, clientY)
  return hit ? [hit] : []
}

/** 穿透绘图层，查找点击位置下的高亮/下划线 DOM 元素 */
export function findMarkupElementAtPoint(
  root: HTMLElement,
  clientX: number,
  clientY: number
): HTMLElement | null {
  const doc = root.ownerDocument
  for (const el of collectElementsAtPoint(doc, clientX, clientY)) {
    if (!(el instanceof Element)) continue
    if (isOverlayHitTarget(el)) continue
    if (!root.contains(el)) continue
    const markup = el.closest(MARKUP_HIT_SELECTOR)
    if (markup instanceof HTMLElement && root.contains(markup)) return markup
  }
  return null
}

/** 橡皮擦命中测试：高亮/下划线文本标记 */
export function hitTestMarkupAnnotation(
  annotations: Annotation[],
  clientX: number,
  clientY: number,
  surface: HTMLElement
): Annotation | undefined {
  const markup = findMarkupElementAtPoint(surface, clientX, clientY)
  if (!markup) return undefined
  return matchMarkupAnnotation(annotations, expandMarkupText(markup))
}

export function scrollToAnnotationText(root: HTMLElement, selectedText: string): boolean {
  if (!selectedText.trim()) return false
  const domRange = findTextRangeInRoot(root, selectedText)
  if (!domRange) return false
  const rect = domRange.getBoundingClientRect()
  if (rect.height <= 0) return false
  const scrollHost = root.closest('.annotated-viewer') ?? root
  scrollHost.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  ;(domRange.startContainer.parentElement ?? root).scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  return true
}

export function blockViewerContextMenu(e: { preventDefault(): void }): void {
  const tool = useWorkspaceStore.getState().annotationTool
  if (toolUsesRightClickUndo(tool)) {
    e.preventDefault()
  }
}
