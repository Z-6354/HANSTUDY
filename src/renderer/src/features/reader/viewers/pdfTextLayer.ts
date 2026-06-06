import * as pdfjsLib from 'pdfjs-dist'

export interface PdfTextLayerHandle {
  layer: HTMLDivElement
  destroy: () => void
}

/** 使用 pdf.js 官方 TextLayer 渲染可选中文本层 */
export async function mountPdfTextLayer(
  page: pdfjsLib.PDFPageProxy,
  viewport: pdfjsLib.PageViewport,
  pageWrap: HTMLElement
): Promise<PdfTextLayerHandle> {
  const layer = document.createElement('div')
  layer.className = 'textLayer'
  layer.style.setProperty('--scale-factor', String(viewport.scale))
  pageWrap.appendChild(layer)

  const textContentSource = page.streamTextContent({ includeMarkedContent: true })
  const textLayer = new pdfjsLib.TextLayer({
    textContentSource,
    container: layer,
    viewport
  })

  await textLayer.render()

  return {
    layer,
    destroy: () => {
      textLayer.cancel()
      layer.remove()
    }
  }
}
