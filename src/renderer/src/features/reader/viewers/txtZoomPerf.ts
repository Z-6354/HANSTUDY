import { normalizeWheelDelta, wheelDeltaToZoomFactor } from './pdfViewerPerf'

export const TXT_ZOOM_MIN = 0.75
export const TXT_ZOOM_MAX = 2
export const TXT_ZOOM_STEP = 0.1
export const TXT_BASE_FONT_SIZE = 14
export const TXT_ZOOM_SAVE_DEBOUNCE_MS = 320
export const TXT_ZOOM_MONACO_COMMIT_MS = 180

export function clampTxtZoom(zoom: number): number {
  return Math.min(TXT_ZOOM_MAX, Math.max(TXT_ZOOM_MIN, Math.round(zoom * 100) / 100))
}

export function applyTxtWheelZoom(current: number, deltaY: number, deltaMode: number): number {
  const normalized = normalizeWheelDelta(deltaY, deltaMode)
  if (Math.abs(normalized) < 4) return current
  return clampTxtZoom(current * wheelDeltaToZoomFactor(normalized))
}
