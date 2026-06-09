import { BrowserWindow, nativeImage, type NativeImage } from 'electron'
import { compressCapturedDataUrl } from './imagePayloadService'
import { getActiveGuestLayerForCapture } from '../web/webGuestService'

export interface WindowCaptureResult {
  dataUrl: string
  width: number
  height: number
  displayWidth: number
  displayHeight: number
}

function compositeNativeImage(
  base: NativeImage,
  overlay: NativeImage,
  offsetX: number,
  offsetY: number
): NativeImage {
  const baseSize = base.getSize()
  const overlaySize = overlay.getSize()
  const baseBmp = Buffer.from(base.toBitmap())
  const overlayBmp = Buffer.from(overlay.toBitmap())

  const bw = baseSize.width
  const bh = baseSize.height
  const ow = overlaySize.width
  const oh = overlaySize.height

  for (let y = 0; y < oh; y += 1) {
    for (let x = 0; x < ow; x += 1) {
      const destX = offsetX + x
      const destY = offsetY + y
      if (destX < 0 || destY < 0 || destX >= bw || destY >= bh) continue

      const srcIdx = (y * ow + x) * 4
      const destIdx = (destY * bw + destX) * 4
      const alpha = overlayBmp[srcIdx + 3]! / 255
      if (alpha <= 0) continue

      if (alpha >= 1) {
        baseBmp[destIdx] = overlayBmp[srcIdx]!
        baseBmp[destIdx + 1] = overlayBmp[srcIdx + 1]!
        baseBmp[destIdx + 2] = overlayBmp[srcIdx + 2]!
        baseBmp[destIdx + 3] = overlayBmp[srcIdx + 3]!
        continue
      }

      for (let c = 0; c < 3; c += 1) {
        baseBmp[destIdx + c] = Math.round(
          overlayBmp[srcIdx + c]! * alpha + baseBmp[destIdx + c]! * (1 - alpha)
        )
      }
      baseBmp[destIdx + 3] = Math.max(baseBmp[destIdx + 3]!, overlayBmp[srcIdx + 3]!)
    }
  }

  return nativeImage.createFromBitmap(baseBmp, { width: bw, height: bh })
}

function scaleGuestOffset(
  guestBounds: Electron.Rectangle,
  displayWidth: number,
  displayHeight: number,
  captureWidth: number,
  captureHeight: number
): { x: number; y: number } {
  return {
    x: Math.round(guestBounds.x * (captureWidth / displayWidth)),
    y: Math.round(guestBounds.y * (captureHeight / displayHeight))
  }
}

/** 截取本应用主窗口当前画面（含内嵌网页 BrowserView） */
export async function captureMainWindowFrame(
  mainWindow: BrowserWindow
): Promise<WindowCaptureResult> {
  const bounds = mainWindow.getBounds()
  const displayWidth = bounds.width
  const displayHeight = bounds.height

  let image = await mainWindow.webContents.capturePage()
  const captureSize = image.getSize()

  const guestLayer = getActiveGuestLayerForCapture()
  if (guestLayer && !guestLayer.webContents.isDestroyed()) {
    try {
      let guestImage = await guestLayer.webContents.capturePage()
      if (!guestImage.isEmpty()) {
        const scaleX = captureSize.width / displayWidth
        const scaleY = captureSize.height / displayHeight
        const expectedW = Math.max(1, Math.round(guestLayer.bounds.width * scaleX))
        const expectedH = Math.max(1, Math.round(guestLayer.bounds.height * scaleY))
        const guestSize = guestImage.getSize()
        if (guestSize.width !== expectedW || guestSize.height !== expectedH) {
          guestImage = guestImage.resize({ width: expectedW, height: expectedH, quality: 'best' })
        }
        const offset = scaleGuestOffset(
          guestLayer.bounds,
          displayWidth,
          displayHeight,
          captureSize.width,
          captureSize.height
        )
        image = compositeNativeImage(image, guestImage, offset.x, offset.y)
      }
    } catch {
      // 网页层截取失败时仍使用主窗口画面
    }
  }

  const size = image.getSize()
  const dataUrl = compressCapturedDataUrl(image.toDataURL())
  return {
    dataUrl,
    width: size.width,
    height: size.height,
    displayWidth,
    displayHeight
  }
}
