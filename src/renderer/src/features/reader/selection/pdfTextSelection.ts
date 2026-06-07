/** PDF textLayer 选区：按视觉行序重建，避免 DOM 顺序导致跨行后下方全选 */

export const PDF_LINE_Y_THRESHOLD = 4

export interface PdfTextSegment {
  node: Text
  start: number
}

export function getSortedPdfTextSpans(textLayer: HTMLElement): HTMLElement[] {
  const spans = Array.from(textLayer.querySelectorAll('span')).filter(
    (span) => (span.textContent?.length ?? 0) > 0
  )
  return spans.sort((a, b) => {
    const ra = a.getBoundingClientRect()
    const rb = b.getBoundingClientRect()
    if (Math.abs(ra.top - rb.top) > PDF_LINE_Y_THRESHOLD) return ra.top - rb.top
    return ra.left - rb.left
  })
}

export function groupPdfSpansByLine(spans: HTMLElement[]): HTMLElement[][] {
  if (spans.length === 0) return []
  const lines: HTMLElement[][] = []
  let current: HTMLElement[] = []
  let lastTop = spans[0].getBoundingClientRect().top

  for (const span of spans) {
    const top = span.getBoundingClientRect().top
    if (current.length > 0 && Math.abs(top - lastTop) > PDF_LINE_Y_THRESHOLD) {
      lines.push(current)
      current = []
    }
    current.push(span)
    lastTop = top
  }
  if (current.length > 0) lines.push(current)
  return lines
}

function findSpanForNode(node: Node | null, spans: HTMLElement[]): HTMLElement | null {
  if (!node) return null
  const el =
    node.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : node instanceof Element
        ? node
        : null
  const span = el?.closest('.textLayer span')
  if (!(span instanceof HTMLElement)) return null
  return spans.includes(span) ? span : null
}

function lineIndexOf(lines: HTMLElement[][], span: HTMLElement): number {
  return lines.findIndex((line) => line.includes(span))
}

function spanIndexInLine(line: HTMLElement[], span: HTMLElement): number {
  return line.indexOf(span)
}

function textOffsetInSpan(span: HTMLElement, node: Node | null, offset: number): number {
  if (!node) return 0
  if (node.nodeType === Node.TEXT_NODE && node.parentElement === span) {
    return Math.max(0, Math.min(offset, node.textContent?.length ?? 0))
  }
  if (node === span) {
    let charCount = 0
    for (let i = 0; i < Math.min(offset, span.childNodes.length); i++) {
      charCount += span.childNodes[i].textContent?.length ?? 0
    }
    return charCount
  }
  return 0
}

function setRangeEndpoint(
  range: Range,
  side: 'start' | 'end',
  span: HTMLElement,
  charOffset: number
): void {
  const textNode = span.firstChild
  if (!(textNode instanceof Text)) return
  const clamped = Math.max(0, Math.min(charOffset, textNode.length))
  if (side === 'start') range.setStart(textNode, clamped)
  else range.setEnd(textNode, clamped)
}

/** 按视觉行序拼接选中文本（不依赖 Range.toString 的 DOM 顺序） */
export function pdfSelectedTextFromEndpoints(
  lines: HTMLElement[][],
  anchorLine: number,
  anchorSpanIdx: number,
  anchorOff: number,
  focusLine: number,
  focusSpanIdx: number,
  focusOff: number
): string {
  const lineTexts: string[] = []

  for (let lineIdx = anchorLine; lineIdx <= focusLine; lineIdx++) {
    const line = lines[lineIdx]
    let lineText = ''
    for (let spanIdx = 0; spanIdx < line.length; spanIdx++) {
      if (lineIdx === anchorLine && spanIdx < anchorSpanIdx) continue
      if (lineIdx === focusLine && spanIdx > focusSpanIdx) continue

      const textNode = line[spanIdx].firstChild
      if (!(textNode instanceof Text)) continue
      const content = textNode.textContent ?? ''
      let start = 0
      let end = content.length
      if (lineIdx === anchorLine && spanIdx === anchorSpanIdx) start = anchorOff
      if (lineIdx === focusLine && spanIdx === focusSpanIdx) end = focusOff
      if (start >= end) continue
      lineText += content.slice(start, end)
    }
    lineTexts.push(lineText)
  }

  return lineTexts.join('\n')
}

export interface PdfNormalizedSelection {
  range: Range
  text: string
}

/** 按 anchor/focus 构建 PDF 选区与文本 */
export function buildPdfSelectionFromAnchorFocus(
  textLayer: HTMLElement,
  anchor: { node: Node | null; offset: number },
  focus: { node: Node | null; offset: number }
): PdfNormalizedSelection | null {
  const spans = getSortedPdfTextSpans(textLayer)
  if (!spans.length) return null

  const lines = groupPdfSpansByLine(spans)
  const anchorSpan = findSpanForNode(anchor.node, spans)
  const focusSpan = findSpanForNode(focus.node, spans)
  if (!anchorSpan || !focusSpan) return null

  let anchorLine = lineIndexOf(lines, anchorSpan)
  let focusLine = lineIndexOf(lines, focusSpan)
  let anchorSpanIdx = spanIndexInLine(lines[anchorLine], anchorSpan)
  let focusSpanIdx = spanIndexInLine(lines[focusLine], focusSpan)
  let anchorOff = textOffsetInSpan(anchorSpan, anchor.node, anchor.offset)
  let focusOff = textOffsetInSpan(focusSpan, focus.node, focus.offset)

  const backward =
    focusLine < anchorLine ||
    (focusLine === anchorLine &&
      (focusSpanIdx < anchorSpanIdx ||
        (focusSpanIdx === anchorSpanIdx && focusOff < anchorOff)))

  if (backward) {
    ;[anchorLine, focusLine, anchorSpanIdx, focusSpanIdx, anchorOff, focusOff] = [
      focusLine,
      anchorLine,
      focusSpanIdx,
      anchorSpanIdx,
      focusOff,
      anchorOff
    ]
  }

  const range = document.createRange()
  const startSpan = lines[anchorLine][anchorSpanIdx]
  setRangeEndpoint(range, 'start', startSpan, anchorOff)
  const endSpan = lines[focusLine][focusSpanIdx]
  setRangeEndpoint(range, 'end', endSpan, focusOff)
  if (range.collapsed) return null

  const text = pdfSelectedTextFromEndpoints(
    lines,
    anchorLine,
    anchorSpanIdx,
    anchorOff,
    focusLine,
    focusSpanIdx,
    focusOff
  )
  if (!text.trim()) return null

  return { range, text }
}

export function buildPdfRangeFromAnchorFocus(
  textLayer: HTMLElement,
  anchor: { node: Node | null; offset: number },
  focus: { node: Node | null; offset: number }
): Range | null {
  return buildPdfSelectionFromAnchorFocus(textLayer, anchor, focus)?.range ?? null
}

export function findTextLayerFromSelection(sel: Selection): HTMLElement | null {
  const node = sel.anchorNode ?? sel.focusNode
  const layer = node?.parentElement?.closest('.textLayer')
  return layer instanceof HTMLElement ? layer : null
}

/** 将浏览器 Selection 规范为 PDF 视觉行序选区，并写回 Selection */
export function normalizePdfWindowSelection(sel: Selection): PdfNormalizedSelection | null {
  if (sel.isCollapsed || !sel.rangeCount) return null
  const textLayer = findTextLayerFromSelection(sel)
  if (!textLayer) {
    const range = sel.getRangeAt(0).cloneRange()
    const text = range.toString().replace(/\r\n/g, '\n')
    return text.trim() ? { range, text } : null
  }

  const normalized = buildPdfSelectionFromAnchorFocus(
    textLayer,
    { node: sel.anchorNode, offset: sel.anchorOffset },
    { node: sel.focusNode, offset: sel.focusOffset }
  )
  if (!normalized) return null

  sel.removeAllRanges()
  sel.addRange(normalized.range)
  return { range: normalized.range.cloneRange(), text: normalized.text }
}

/** 按视觉行序收集 PDF 文本（行间插入 \\n），用于标注定位 */
export function collectPdfTextSegments(textLayer: HTMLElement): {
  fullText: string
  segments: PdfTextSegment[]
} {
  const lines = groupPdfSpansByLine(getSortedPdfTextSpans(textLayer))
  const segments: PdfTextSegment[] = []
  let fullText = ''

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    if (lineIdx > 0) {
      fullText += '\n'
    }
    for (const span of lines[lineIdx]) {
      const textNode = span.firstChild
      if (!(textNode instanceof Text) || !textNode.length) continue
      segments.push({ node: textNode, start: fullText.length })
      fullText += textNode.textContent ?? ''
    }
  }

  return { fullText, segments }
}

function locatePdfTextOffset(
  segments: PdfTextSegment[],
  offset: number
): { node: Text; offset: number } | null {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const nextStart = i + 1 < segments.length ? segments[i + 1].start : Number.POSITIVE_INFINITY
    if (offset >= seg.start && offset < nextStart) {
      return { node: seg.node, offset: offset - seg.start }
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

function pdfRangeFromTextOffsets(
  segments: PdfTextSegment[],
  start: number,
  end: number
): Range | null {
  const startPos = locatePdfTextOffset(segments, start)
  const endPos = locatePdfTextOffset(segments, end)
  if (!startPos || !endPos) return null
  const range = document.createRange()
  range.setStart(startPos.node, startPos.offset)
  range.setEnd(endPos.node, endPos.offset)
  return range.collapsed ? null : range
}

function pdfSearchVariants(text: string): string[] {
  const variants = new Set<string>()
  variants.add(text)
  variants.add(text.replace(/\r\n/g, '\n'))
  if (!text.includes('\n')) {
    variants.add(text.replace(/\s+/g, ' ').trim())
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

/** 在 PDF textLayer 中按视觉行序查找文本，避免换行变体误匹配下方全文 */
export function findPdfTextRangeInTextLayer(
  textLayer: HTMLElement,
  selectedText: string
): Range | null {
  if (!selectedText.trim()) return null
  const { fullText, segments } = collectPdfTextSegments(textLayer)
  if (!segments.length) return null

  for (const attempt of pdfSearchVariants(selectedText)) {
    const index = fullText.indexOf(attempt)
    if (index === -1) continue
    const range = pdfRangeFromTextOffsets(segments, index, index + attempt.length)
    if (range) return range
  }
  return null
}
