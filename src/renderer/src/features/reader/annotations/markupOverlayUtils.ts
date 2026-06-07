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

/** 同行文本矩形分组阈值（像素） */
export const MARKUP_LINE_Y_THRESHOLD = 6

/** 下划线与文本基线的间距 */
export const UNDERLINE_GAP = 3

/** 下划线粗细 */
export const UNDERLINE_THICKNESS = 2

function rectsOnSameLine(a: ContentRect, b: ContentRect): boolean {
  if (Math.abs(a.y - b.y) <= MARKUP_LINE_Y_THRESHOLD) return true
  const aBottom = a.y + a.height
  const bBottom = b.y + b.height
  const overlap = Math.min(aBottom, bBottom) - Math.max(a.y, b.y)
  const minH = Math.min(a.height, b.height)
  return overlap > minH * 0.35
}

/** 将字符级 client rect 按视觉行分组 */
export function groupContentRectsByLine(rects: ContentRect[]): ContentRect[][] {
  if (rects.length === 0) return []
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x)
  const lines: ContentRect[][] = [[sorted[0]]]

  for (let i = 1; i < sorted.length; i++) {
    const rect = sorted[i]
    const lastLine = lines[lines.length - 1]
    if (lastLine.some((existing) => rectsOnSameLine(existing, rect))) {
      lastLine.push(rect)
    } else {
      lines.push([rect])
    }
  }

  return lines
}

/** 单行文本：取最低 bottom，在其下 gap 处画连续横线 */
export function mergeLineRectsToUnderlineBar(
  line: ContentRect[],
  gap = UNDERLINE_GAP,
  thickness = UNDERLINE_THICKNESS
): ContentRect {
  const lineBottom = Math.max(...line.map((r) => r.y + r.height))
  const left = Math.min(...line.map((r) => r.x))
  const right = Math.max(...line.map((r) => r.x + r.width))
  return {
    x: left,
    y: lineBottom + gap,
    width: Math.max(right - left, 2),
    height: thickness
  }
}

/** 单行文本：合并为连续高亮块（覆盖该行 min top ~ max bottom） */
export function mergeLineRectsToHighlightBar(line: ContentRect[]): ContentRect {
  const top = Math.min(...line.map((r) => r.y))
  const bottom = Math.max(...line.map((r) => r.y + r.height))
  const left = Math.min(...line.map((r) => r.x))
  const right = Math.max(...line.map((r) => r.x + r.width))
  return {
    x: left,
    y: top,
    width: Math.max(right - left, 2),
    height: Math.max(bottom - top, 2)
  }
}

/** 高亮：按行合并为连续块，避免中英文混排时逐字断裂 */
export function mergeContentRectsForHighlight(rects: ContentRect[]): ContentRect[] {
  return groupContentRectsByLine(rects).map((line) => mergeLineRectsToHighlightBar(line))
}

/** 下划线：按行合并为连续横条，避免中英文混排时逐字断裂 */
export function mergeContentRectsForUnderline(
  rects: ContentRect[],
  gap = UNDERLINE_GAP,
  thickness = UNDERLINE_THICKNESS
): ContentRect[] {
  return groupContentRectsByLine(rects).map((line) =>
    mergeLineRectsToUnderlineBar(line, gap, thickness)
  )
}

export function prepareMarkupDisplayRects(
  annotation: Annotation,
  rects: ContentRect[]
): ContentRect[] {
  if (annotation.type === 'underline') return mergeContentRectsForUnderline(rects)
  if (annotation.type === 'highlight') return mergeContentRectsForHighlight(rects)
  return rects
}

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
    const displayRects = prepareMarkupDisplayRects(ann, resolveRects(ann))
    for (const r of displayRects) {
      const hitY =
        ann.type === 'underline'
          ? py >= r.y - 4 && py <= r.y + r.height + 4
          : py >= r.y && py <= r.y + r.height
      if (px >= r.x && px <= r.x + r.width && hitY) return ann
    }
  }
  return undefined
}
