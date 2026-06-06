import * as pdfjsLib from 'pdfjs-dist'
import { mountPdfTextLayer, type PdfTextLayerHandle } from './pdfTextLayer'

export interface PdfPageSlot {
  pageNo: number
  wrap: HTMLDivElement
  baseWidth: number
  baseHeight: number
  rendered: boolean
  rendering: boolean
  textHandle: PdfTextLayerHandle | null
}

export interface PdfPagePlaceholder {
  pageNo: number
  wrap: HTMLDivElement
  baseWidth: number
  baseHeight: number
}

export function createPagePlaceholder(
  pageNo: number,
  viewport: pdfjsLib.PageViewport,
  baseWidth: number,
  baseHeight: number
): PdfPagePlaceholder {
  const pageWrap = document.createElement('div')
  pageWrap.className = 'pdf-page-wrap pdf-page-placeholder'
  pageWrap.dataset.page = String(pageNo)
  applySlotSize(pageWrap, viewport.width, viewport.height)
  return { pageNo, wrap: pageWrap, baseWidth, baseHeight }
}

export function applySlotSize(wrap: HTMLElement, width: number, height: number): void {
  wrap.style.width = `${width}px`
  wrap.style.height = `${height}px`
}

export function resizeSlotToScale(slot: PdfPageSlot, scale: number): void {
  applySlotSize(slot.wrap, slot.baseWidth * scale, slot.baseHeight * scale)
}

/** 缩放重绘前拉伸旧画布填满 slot，避免从左上角 scale 造成视觉偏移 */
export function fitStaleCanvasToSlot(slot: PdfPageSlot, newScale: number, oldScale: number): void {
  const canvas = slot.wrap.querySelector('canvas.pdf-page') as HTMLCanvasElement | null
  if (!canvas || oldScale <= 0) return
  const factor = newScale / oldScale
  if (Math.abs(factor - 1) < 0.001) {
    canvas.style.width = ''
    canvas.style.height = ''
    canvas.style.transform = ''
    canvas.style.transformOrigin = ''
    return
  }
  canvas.style.transform = ''
  canvas.style.transformOrigin = ''
  canvas.style.width = '100%'
  canvas.style.height = '100%'
}

function clearStaleCanvasFit(canvasWrap: HTMLElement): void {
  const canvas = canvasWrap.querySelector('canvas.pdf-page') as HTMLCanvasElement | null
  if (!canvas) return
  canvas.style.width = ''
  canvas.style.height = ''
  canvas.style.transform = ''
  canvas.style.transformOrigin = ''
}

export async function buildPagePlaceholders(
  pdf: pdfjsLib.PDFDocumentProxy,
  scale: number
): Promise<PdfPagePlaceholder[]> {
  const tasks = Array.from({ length: pdf.numPages }, async (_, index) => {
    const pageNo = index + 1
    const page = await pdf.getPage(pageNo)
    const baseViewport = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale })
    return createPagePlaceholder(pageNo, viewport, baseViewport.width, baseViewport.height)
  })
  return Promise.all(tasks)
}

export async function renderPdfPage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNo: number,
  scale: number,
  pageWrap: HTMLElement,
  signal?: { cancelled: () => boolean }
): Promise<PdfTextLayerHandle> {
  if (signal?.cancelled()) {
    throw new Error('render cancelled')
  }

  const page = await pdf.getPage(pageNo)
  const viewport = page.getViewport({ scale })

  const canvasWrap = document.createElement('div')
  canvasWrap.className = 'pdf-canvas-wrap'

  const canvas = document.createElement('canvas')
  canvas.className = 'pdf-page'
  canvas.dataset.page = String(pageNo)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error(`无法创建第 ${pageNo} 页画布`)
  }

  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: context, viewport }).promise

  if (signal?.cancelled()) {
    throw new Error('render cancelled')
  }

  canvasWrap.appendChild(canvas)
  clearStaleCanvasFit(canvasWrap)
  swapPageCanvas(pageWrap, canvasWrap)

  return mountPdfTextLayer(page, viewport, pageWrap)
}

/** 原子替换画布：新 canvas 就绪后再换掉旧节点，避免中间空白帧 */
function swapPageCanvas(pageWrap: HTMLElement, canvasWrap: HTMLDivElement): void {
  slotTextLayersTeardown(pageWrap)
  pageWrap.classList.remove('pdf-page-placeholder')
  const existing = pageWrap.querySelector('.pdf-canvas-wrap')
  if (existing) {
    pageWrap.replaceChild(canvasWrap, existing)
  } else {
    pageWrap.appendChild(canvasWrap)
  }
}

function slotTextLayersTeardown(pageWrap: HTMLElement): void {
  pageWrap.querySelectorAll('.textLayer').forEach((el) => el.remove())
}

export function markSlotNeedsRerender(slot: PdfPageSlot): void {
  slot.rendered = false
  slot.rendering = false
}

export function destroyPageSlot(slot: PdfPageSlot): void {
  slot.textHandle?.destroy()
  slot.textHandle = null
  slot.rendered = false
  slot.rendering = false
  slot.wrap.classList.add('pdf-page-placeholder')
  slot.wrap.replaceChildren()
}

export function isPageNearViewport(
  pageWrap: HTMLElement,
  container: HTMLElement,
  marginPx = 240
): boolean {
  const rect = pageWrap.getBoundingClientRect()
  const root = container.getBoundingClientRect()
  if (rect.height <= 0) return false
  return rect.bottom >= root.top - marginPx && rect.top <= root.bottom + marginPx
}
