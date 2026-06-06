import type { Annotation, TextRange } from '../../../shared/types'
import { useWorkspaceStore } from '../stores/workspaceStore'

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

export function applyTextMarkup(
  root: HTMLElement,
  selectedText: string,
  className: string,
  tagName: 'mark' | 'u' = 'mark'
): void {
  if (!selectedText.trim()) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? ''
    const index = text.indexOf(selectedText)
    if (index === -1) continue
    const range = document.createRange()
    range.setStart(node, index)
    range.setEnd(node, index + selectedText.length)
    const el = document.createElement(tagName)
    el.className = className
    try {
      range.surroundContents(el)
    } catch {
      // overlapping ranges — skip
    }
    return
  }
}

export function applyTextHighlights(root: HTMLElement, selectedText: string, className: string): void {
  applyTextMarkup(root, selectedText, className, 'mark')
}

export function applyDomAnnotation(
  root: HTMLElement,
  type: 'highlight' | 'underline',
  selectedText: string
): void {
  if (type === 'highlight') {
    applyTextMarkup(root, selectedText, 'annotation-highlight', 'mark')
  } else {
    applyTextMarkup(root, selectedText, 'annotation-underline', 'u')
  }
}

export function applyStoredDomAnnotations(root: HTMLElement, annotations: Annotation[]): void {
  for (const a of annotations) {
    if (!a.selectedText) continue
    if (a.type === 'highlight') {
      applyTextMarkup(root, a.selectedText, 'annotation-highlight', 'mark')
    } else if (a.type === 'underline') {
      applyTextMarkup(root, a.selectedText, 'annotation-underline', 'u')
    }
  }
}

export function scrollToAnnotationText(root: HTMLElement, selectedText: string): boolean {
  if (!selectedText.trim()) return false
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? ''
    const index = text.indexOf(selectedText)
    if (index === -1) continue
    const range = document.createRange()
    range.setStart(node, index)
    range.setEnd(node, index + Math.min(selectedText.length, text.length - index))
    const rect = range.getBoundingClientRect()
    if (rect.height <= 0) continue
    const scrollHost = root.closest('.annotated-viewer') ?? root
    scrollHost.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    ;(node.parentElement ?? root).scrollIntoView({ behavior: 'smooth', block: 'center' })
    return true
  }
  return false
}

export function blockViewerContextMenu(e: { preventDefault(): void }): void {
  if (useWorkspaceStore.getState().annotationTool !== 'pen') {
    e.preventDefault()
  }
}
