import type { CropRect } from '../ai/imageCropUtils'

export function normalizeDragRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  maxWidth: number,
  maxHeight: number
): CropRect {
  let x = Math.min(startX, endX)
  let y = Math.min(startY, endY)
  let width = Math.abs(endX - startX)
  let height = Math.abs(endY - startY)

  x = Math.max(0, Math.min(x, maxWidth))
  y = Math.max(0, Math.min(y, maxHeight))
  width = Math.min(width, maxWidth - x)
  height = Math.min(height, maxHeight - y)
  return { x, y, width, height }
}

export function mapWindowRectToCaptureRect(
  selection: CropRect,
  displayWidth: number,
  displayHeight: number,
  captureWidth: number,
  captureHeight: number
): CropRect | null {
  if (selection.width < 2 || selection.height < 2) return null
  const scaleX = captureWidth / displayWidth
  const scaleY = captureHeight / displayHeight
  const x = Math.max(0, Math.round(selection.x * scaleX))
  const y = Math.max(0, Math.round(selection.y * scaleY))
  const width = Math.min(captureWidth - x, Math.round(selection.width * scaleX))
  const height = Math.min(captureHeight - y, Math.round(selection.height * scaleY))
  if (width < 2 || height < 2) return null
  return { x, y, width, height }
}

export function computeToolbarPosition(
  selection: CropRect,
  toolbarWidth: number,
  toolbarHeight: number,
  viewportWidth: number,
  viewportHeight: number
): { left: number; top: number } {
  const margin = 8
  let left = selection.x + selection.width - toolbarWidth
  let top = selection.y + selection.height + margin

  if (top + toolbarHeight > viewportHeight - margin) {
    top = Math.max(margin, selection.y - toolbarHeight - margin)
  }
  if (left < margin) left = margin
  if (left + toolbarWidth > viewportWidth - margin) {
    left = Math.max(margin, viewportWidth - toolbarWidth - margin)
  }
  return { left, top }
}

export async function cropImageDataUrl(dataUrl: string, rect: CropRect): Promise<string> {
  const image = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = rect.width
  canvas.height = rect.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height)
  return canvas.toDataURL('image/png')
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = dataUrl
  })
}
