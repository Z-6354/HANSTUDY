export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayRect {
  offsetX: number
  offsetY: number
  displayWidth: number
  displayHeight: number
  naturalWidth: number
  naturalHeight: number
}

/** 计算 object-fit: contain 下图片在容器内的实际显示区域 */
export function computeContainDisplayRect(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number
): DisplayRect {
  if (naturalWidth <= 0 || naturalHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return {
      offsetX: 0,
      offsetY: 0,
      displayWidth: containerWidth,
      displayHeight: containerHeight,
      naturalWidth,
      naturalHeight
    }
  }

  const scale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight)
  const displayWidth = naturalWidth * scale
  const displayHeight = naturalHeight * scale
  return {
    offsetX: (containerWidth - displayWidth) / 2,
    offsetY: (containerHeight - displayHeight) / 2,
    displayWidth,
    displayHeight,
    naturalWidth,
    naturalHeight
  }
}

export function mapSelectionToNaturalRect(
  selection: CropRect,
  display: DisplayRect
): CropRect | null {
  const { offsetX, offsetY, displayWidth, displayHeight, naturalWidth, naturalHeight } = display
  if (selection.width < 4 || selection.height < 4) return null

  const relX = selection.x - offsetX
  const relY = selection.y - offsetY
  const scaleX = naturalWidth / displayWidth
  const scaleY = naturalHeight / displayHeight

  const x = Math.max(0, Math.round(relX * scaleX))
  const y = Math.max(0, Math.round(relY * scaleY))
  const width = Math.min(naturalWidth - x, Math.round(selection.width * scaleX))
  const height = Math.min(naturalHeight - y, Math.round(selection.height * scaleY))

  if (width < 4 || height < 4) return null
  return { x, y, width, height }
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
