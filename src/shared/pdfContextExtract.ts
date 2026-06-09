/** PDF 对话上下文：按当前页取窗口 */

export const PDF_PAGE_WINDOW_RADIUS = 1

export function resolvePdfCenterPage(options: {
  pdfPage?: number
  scrollRatio?: number
  numPages: number
}): number {
  const total = Math.max(1, options.numPages)
  if (options.pdfPage != null && options.pdfPage > 0) {
    return Math.min(total, Math.max(1, Math.floor(options.pdfPage)))
  }
  if (options.scrollRatio != null) {
    return Math.min(total, Math.max(1, Math.ceil(options.scrollRatio * total)))
  }
  return 1
}

export function computePdfPageWindow(
  centerPage: number,
  numPages: number,
  radius = PDF_PAGE_WINDOW_RADIUS
): { startPage: number; endPage: number } {
  const total = Math.max(1, numPages)
  const center = Math.min(total, Math.max(1, Math.floor(centerPage)))
  return {
    startPage: Math.max(1, center - radius),
    endPage: Math.min(total, center + radius)
  }
}

export function normalizePdfPageRange(
  startPage: number,
  endPage: number,
  numPages: number
): { startPage: number; endPage: number } {
  const total = Math.max(1, numPages)
  const start = Math.min(total, Math.max(1, Math.floor(startPage)))
  const end = Math.min(total, Math.max(start, Math.floor(endPage)))
  return { startPage: start, endPage: end }
}
