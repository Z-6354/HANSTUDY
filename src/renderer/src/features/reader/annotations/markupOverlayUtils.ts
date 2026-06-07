import type { editor as MonacoEditor } from 'monaco-editor'
import type * as MonacoApi from 'monaco-editor'
import type { Annotation, TextRange } from '../../../types/global.d'
import { getContentElement, getScrollContainer, clientToContentPixels } from './shapeUtils'
import { findTextRangeInRoot } from './textUtils'

export interface ContentRect {
  x: number
  y: number
  width: number
  height: number
}

export type MarkupRectResolver = (annotation: Annotation) => ContentRect[]

/** 将 viewport 矩形转为内容表面像素坐标（与 pen/rect 坐标系一致） */
export function clientRectToContentRect(clientRect: DOMRect, surface: HTMLElement): ContentRect {
  const contentEl = getContentElement(surface)
  const scrollEl = getScrollContainer(surface)
  const contentRect = contentEl.getBoundingClientRect()

  if (scrollEl === surface) {
    return {
      x: scrollEl.scrollLeft + (clientRect.left - contentRect.left),
      y: scrollEl.scrollTop + (clientRect.top - contentRect.top),
      width: clientRect.width,
      height: clientRect.height
    }
  }

  return {
    x: clientRect.left - contentRect.left,
    y: clientRect.top - contentRect.top,
    width: clientRect.width,
    height: clientRect.height
  }
}

/** DOM Range → 内容表面多行矩形（不修改 DOM） */
export function domRangeToContentRects(range: Range, surface: HTMLElement): ContentRect[] {
  const rects: ContentRect[] = []
  for (const clientRect of Array.from(range.getClientRects())) {
    if (clientRect.width <= 0 || clientRect.height <= 0) continue
    rects.push(clientRectToContentRect(clientRect, surface))
  }
  return rects
}

export function resolveDomMarkupRects(
  annotation: Annotation,
  surface: HTMLElement,
  root: HTMLElement
): ContentRect[] {
  if (!annotation.selectedText?.trim()) return []
  const range = findTextRangeInRoot(root, annotation.selectedText)
  if (!range || range.collapsed) return []
  return domRangeToContentRects(range, surface)
}

/** Monaco 行列范围 → 内容表面矩形（随滚动/缩放重算） */
export function monacoRangeToContentRects(
  editor: MonacoEditor.IStandaloneCodeEditor,
  monaco: typeof MonacoApi,
  textRange: TextRange,
  surface: HTMLElement
): ContentRect[] {
  const model = editor.getModel()
  const editorNode = editor.getDomNode()
  if (!model || !editorNode) return []

  const range = new monaco.Range(
    textRange.startLine,
    textRange.startColumn,
    textRange.endLine,
    textRange.endColumn
  )

  const rects: ContentRect[] = []
  for (let line = range.startLineNumber; line <= range.endLineNumber; line++) {
    const startCol = line === range.startLineNumber ? range.startColumn : 1
    const endCol = line === range.endLineNumber ? range.endColumn : model.getLineMaxColumn(line)

    const startPos = editor.getScrolledVisiblePosition({ lineNumber: line, column: startCol })
    const endPos = editor.getScrolledVisiblePosition({ lineNumber: line, column: endCol })
    if (!startPos || !endPos) continue

    const lineRect = editorNode.getBoundingClientRect()
    const clientRect = new DOMRect(
      lineRect.left + startPos.left,
      lineRect.top + startPos.top,
      Math.max(endPos.left - startPos.left, 2),
      startPos.height || 18
    )
    rects.push(clientRectToContentRect(clientRect, surface))
  }
  return rects
}

export function resolveDefaultMarkupRects(
  annotation: Annotation,
  surface: HTMLElement
): ContentRect[] {
  if (!annotation.selectedText?.trim()) return []
  const root = getContentElement(surface)
  return resolveDomMarkupRects(annotation, surface, root)
}

export function resolveAllMarkupRects(
  annotations: Annotation[],
  surface: HTMLElement,
  resolver: MarkupRectResolver | null
): Map<string, ContentRect[]> {
  const result = new Map<string, ContentRect[]>()
  for (const ann of annotations) {
    if (ann.type !== 'highlight' && ann.type !== 'underline') continue
    const rects = resolver ? resolver(ann) : resolveDefaultMarkupRects(ann, surface)
    if (rects.length > 0) result.set(ann.id, rects)
  }
  return result
}

/** 橡皮擦：按覆盖层矩形命中（逆序取最近） */
export function hitTestMarkupOverlay(
  annotations: Annotation[],
  clientX: number,
  clientY: number,
  surface: HTMLElement,
  resolveRects: MarkupRectResolver
): Annotation | undefined {
  const { x: px, y: py } = clientToContentPixels(clientX, clientY, surface)

  for (const ann of [...annotations].reverse()) {
    if (ann.type !== 'highlight' && ann.type !== 'underline') continue
    for (const r of resolveRects(ann)) {
      const hitY =
        ann.type === 'underline'
          ? py >= r.y + r.height - 6 && py <= r.y + r.height + 2
          : py >= r.y && py <= r.y + r.height
      if (px >= r.x && px <= r.x + r.width && hitY) return ann
    }
  }
  return undefined
}
