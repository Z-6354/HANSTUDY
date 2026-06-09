import { nativeImage } from 'electron'
import { readFile } from 'fs/promises'
import { extname } from 'path'
import { MAX_CHAT_IMAGE_BYTES } from '../../shared/chatPayload'

const MAX_DIMENSION = 2048

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp'
}

function resizeIfNeeded(img: Electron.NativeImage): Electron.NativeImage {
  const { width, height } = img.getSize()
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) return img
  const scale = MAX_DIMENSION / Math.max(width, height)
  return img.resize({
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    quality: 'best'
  })
}

function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return dataUrl.length
  const base64 = dataUrl.slice(comma + 1)
  return Math.floor((base64.length * 3) / 4)
}

function encodeImage(img: Electron.NativeImage, mime: string): string {
  if (mime === 'image/jpeg') {
    return `data:image/jpeg;base64,${img.toJPEG(85).toString('base64')}`
  }
  return `data:image/png;base64,${img.toPNG().toString('base64')}`
}

function compressToLimit(img: Electron.NativeImage, mime: string): string {
  let current = resizeIfNeeded(img)
  let dataUrl = encodeImage(current, mime)
  if (dataUrlByteLength(dataUrl) <= MAX_CHAT_IMAGE_BYTES) return dataUrl

  if (mime !== 'image/jpeg') {
    dataUrl = encodeImage(current, 'image/jpeg')
    if (dataUrlByteLength(dataUrl) <= MAX_CHAT_IMAGE_BYTES) return dataUrl
  }

  for (const quality of [75, 60, 45, 30]) {
    const jpeg = current.toJPEG(quality)
    dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`
    if (dataUrlByteLength(dataUrl) <= MAX_CHAT_IMAGE_BYTES) return dataUrl
  }

  const { width, height } = current.getSize()
  current = current.resize({
    width: Math.max(1, Math.round(width * 0.7)),
    height: Math.max(1, Math.round(height * 0.7)),
    quality: 'best'
  })
  dataUrl = encodeImage(current, 'image/jpeg')
  if (dataUrlByteLength(dataUrl) > MAX_CHAT_IMAGE_BYTES) {
    throw new Error('图片过大，请换一张较小的图片或裁剪后再试')
  }
  return dataUrl
}

export async function readImageFileAsDataUrl(
  filePath: string
): Promise<{ dataUrl: string; name: string }> {
  const ext = extname(filePath).toLowerCase()
  const mime = MIME_BY_EXT[ext]
  if (!mime) {
    throw new Error('仅支持 PNG、JPG、WEBP、GIF、BMP 图片')
  }

  const buffer = await readFile(filePath)
  const img = nativeImage.createFromBuffer(buffer)
  if (img.isEmpty()) {
    throw new Error('无法读取图片文件')
  }

  const dataUrl = compressToLimit(img, mime)
  const name = filePath.replace(/^.*[\\/]/, '')
  return { dataUrl, name }
}

export function compressCapturedDataUrl(dataUrl: string): string {
  const img = nativeImage.createFromDataURL(dataUrl)
  if (img.isEmpty()) {
    throw new Error('截图数据无效')
  }
  return compressToLimit(img, 'image/png')
}
