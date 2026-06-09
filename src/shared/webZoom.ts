export const WEB_ZOOM_MIN = 0.5
export const WEB_ZOOM_MAX = 3
export const WEB_ZOOM_STEP = 0.1
export const WEB_ZOOM_DEFAULT = 1

export function clampWebZoom(zoom: number): number {
  return Math.min(WEB_ZOOM_MAX, Math.max(WEB_ZOOM_MIN, Math.round(zoom * 100) / 100))
}

export function webZoomOrigin(url: string): string {
  if (!url.trim()) return ''
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin
    }
    return parsed.href
  } catch {
    return url
  }
}
