import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { ScreenshotInitPayload } from '@shared/screenshot'
import type { CropRect } from '../ai/imageCropUtils'
import {
  computeToolbarPosition,
  cropImageDataUrl,
  mapWindowRectToCaptureRect,
  normalizeDragRect
} from './screenshotRegionUtils'

const TOOLBAR_WIDTH = 148
const TOOLBAR_HEIGHT = 36

export function ScreenshotRegionPicker(): JSX.Element | null {
  const [payload, setPayload] = useState<ScreenshotInitPayload | null>(null)
  const [dragging, setDragging] = useState(false)
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [selection, setSelection] = useState<CropRect | null>(null)
  const [busy, setBusy] = useState(false)
  const [imageReady, setImageReady] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const readySentRef = useRef(false)

  useEffect(() => {
    return window.api.screenshot.onInit((data) => {
      readySentRef.current = false
      setImageReady(false)
      setPayload(data)
      setSelection(null)
      setDragging(false)
      setStart(null)
    })
  }, [])

  const notifyOverlayReady = useCallback((): void => {
    if (readySentRef.current) return
    readySentRef.current = true
    window.api.screenshot.notifyReady()
  }, [])

  useEffect(() => {
    if (!payload || imageReady) return
    const img = new Image()
    img.onload = () => {
      setImageReady(true)
      notifyOverlayReady()
    }
    img.onerror = () => notifyOverlayReady()
    img.src = payload.dataUrl
  }, [imageReady, notifyOverlayReady, payload])

  const pointFromEvent = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const rect = stage.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  const confirmSelection = useCallback(async (): Promise<void> => {
    if (!payload || !selection || busy) return
    if (selection.width < 4 || selection.height < 4) return

    const captureRect = mapWindowRectToCaptureRect(
      selection,
      payload.displayWidth,
      payload.displayHeight,
      payload.captureWidth,
      payload.captureHeight
    )
    if (!captureRect) return

    setBusy(true)
    try {
      const cropped = await cropImageDataUrl(payload.dataUrl, captureRect)
      window.api.screenshot.submit(cropped)
    } catch {
      window.api.screenshot.cancel()
    } finally {
      setBusy(false)
    }
  }, [busy, payload, selection])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        window.api.screenshot.cancel()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        void confirmSelection()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmSelection])

  const handlePointerDown = (e: React.PointerEvent): void => {
    if (busy || !payload || !imageReady) return
    const point = pointFromEvent(e.clientX, e.clientY)
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    setStart(point)
    setSelection({ x: point.x, y: point.y, width: 0, height: 0 })
  }

  const handlePointerMove = (e: React.PointerEvent): void => {
    if (!dragging || !start || !payload) return
    const point = pointFromEvent(e.clientX, e.clientY)
    setSelection(
      normalizeDragRect(
        start.x,
        start.y,
        point.x,
        point.y,
        payload.displayWidth,
        payload.displayHeight
      )
    )
  }

  const handlePointerUp = (): void => {
    setDragging(false)
    setStart(null)
  }

  const handleDoubleClick = (): void => {
    void confirmSelection()
  }

  const handleImageReady = (): void => {
    setImageReady(true)
    notifyOverlayReady()
  }

  if (!payload) return null

  const hasSelection = !!selection && selection.width >= 4 && selection.height >= 4
  const toolbarPos =
    hasSelection && selection
      ? computeToolbarPosition(
          selection,
          TOOLBAR_WIDTH,
          TOOLBAR_HEIGHT,
          payload.displayWidth,
          payload.displayHeight
        )
      : null

  return (
    <div
      ref={stageRef}
      className="screenshot-region-root"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      <img
        className={`screenshot-region-bg${imageReady ? ' screenshot-region-bg--ready' : ''}`}
        src={payload.dataUrl}
        alt=""
        draggable={false}
        onLoad={handleImageReady}
      />

      {!hasSelection && (
        <div className="screenshot-region-hint">在本窗口内拖拽选择截图区域</div>
      )}

      {selection && selection.width > 0 && selection.height > 0 && (
        <>
          <div
            className="screenshot-region-mask"
            style={{
              left: selection.x,
              top: selection.y,
              width: selection.width,
              height: selection.height
            }}
          >
            <span className="screenshot-region-size">
              {Math.round(selection.width)} × {Math.round(selection.height)}
            </span>
            <span className="screenshot-region-corner screenshot-region-corner--tl" />
            <span className="screenshot-region-corner screenshot-region-corner--tr" />
            <span className="screenshot-region-corner screenshot-region-corner--bl" />
            <span className="screenshot-region-corner screenshot-region-corner--br" />
          </div>

          {hasSelection && toolbarPos && (
            <div
              className="screenshot-region-toolbar"
              style={{ left: toolbarPos.left, top: toolbarPos.top }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="screenshot-region-btn screenshot-region-btn--confirm"
                title="完成 (Enter)"
                disabled={busy}
                onClick={() => void confirmSelection()}
              >
                <Check size={14} strokeWidth={2} aria-hidden />
                <span>完成</span>
              </button>
              <button
                type="button"
                className="screenshot-region-btn screenshot-region-btn--cancel"
                title="取消 (Esc)"
                disabled={busy}
                onClick={() => window.api.screenshot.cancel()}
              >
                <X size={14} strokeWidth={2} aria-hidden />
                <span>取消</span>
              </button>
            </div>
          )}
        </>
      )}

      <div className="screenshot-region-footer-hint">Enter 确认 · Esc 取消 · 双击确认</div>
    </div>
  )
}
