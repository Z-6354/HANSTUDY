import type * as pdfjsLib from 'pdfjs-dist'

const THUMB_MAX_WIDTH = 108

export async function renderPdfThumbnail(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNo: number,
  signal?: { cancelled: () => boolean }
): Promise<HTMLCanvasElement | null> {
  if (signal?.cancelled()) return null
  const page = await pdf.getPage(pageNo)
  if (signal?.cancelled()) return null

  const baseViewport = page.getViewport({ scale: 1 })
  const scale = THUMB_MAX_WIDTH / baseViewport.width
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  canvas.className = 'pdf-thumb-canvas'

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const renderTask = page.render({ canvasContext: ctx, viewport })
  try {
    await renderTask.promise
  } catch {
    if (signal?.cancelled()) return null
    throw new Error(`thumbnail render failed for page ${pageNo}`)
  }
  if (signal?.cancelled()) {
    renderTask.cancel()
    return null
  }
  return canvas
}
