/** 网页水平裁剪：仅左右边界（0–1），垂直方向始终完整可滚动 */
export interface WebHorizontalCrop {
  left: number
  right: number
}

export const WEB_PAGE_LAYOUT_WIDTH = 1280
export const WEB_CROP_MIN_SPAN = 0.12
export const WEB_CROP_STORAGE_KEY = 'hanstudy-web-crop'

export function clampCrop(crop: WebHorizontalCrop): WebHorizontalCrop {
  let left = Math.max(0, Math.min(1, crop.left))
  let right = Math.max(0, Math.min(1, crop.right))
  if (left > right) {
    const tmp = left
    left = right
    right = tmp
  }
  if (left >= right) {
    return { left: 0, right: 1 }
  }
  if (right - left < WEB_CROP_MIN_SPAN) {
    if (right < 1) {
      right = Math.min(1, left + WEB_CROP_MIN_SPAN)
    }
    if (right - left < WEB_CROP_MIN_SPAN) {
      left = Math.max(0, right - WEB_CROP_MIN_SPAN)
    }
  }
  if (left >= right || right - left < WEB_CROP_MIN_SPAN) {
    return { left: 0, right: 1 }
  }
  return { left, right }
}

export function loadWebCrop(url: string): WebHorizontalCrop {
  try {
    const raw = localStorage.getItem(WEB_CROP_STORAGE_KEY)
    if (!raw) return { left: 0, right: 1 }
    const map = JSON.parse(raw) as Record<string, WebHorizontalCrop>
    const saved = map[url]
    if (!saved) return { left: 0, right: 1 }
    return clampCrop(saved)
  } catch {
    return { left: 0, right: 1 }
  }
}

export function saveWebCrop(url: string, crop: WebHorizontalCrop): void {
  try {
    const raw = localStorage.getItem(WEB_CROP_STORAGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, WebHorizontalCrop>) : {}
    map[url] = clampCrop(crop)
    localStorage.setItem(WEB_CROP_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

export type WebSearchEngine = 'bing' | 'baidu' | 'google'

export const DEFAULT_SEARCH_ENGINE: WebSearchEngine = 'bing'

/** 默认必应；实际以设置中的 searchEngine 为准 */
export function pickDefaultSearchEngine(): WebSearchEngine {
  return DEFAULT_SEARCH_ENGINE
}

export function buildSearchUrl(
  query: string,
  engine: WebSearchEngine = pickDefaultSearchEngine()
): string {
  const q = encodeURIComponent(query.trim())
  switch (engine) {
    case 'baidu':
      return `https://www.baidu.com/s?wd=${q}`
    case 'google':
      return `https://www.google.com/search?q=${q}`
    case 'bing':
    default:
      return `https://www.bing.com/search?q=${q}`
  }
}

export function looksLikeUrl(input: string): boolean {
  const t = input.trim()
  if (!t) return false
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(t)) return true
  if (/\s/.test(t)) return false
  if (/^localhost(:\d+)?(\/|$)/i.test(t)) return true
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(t)) return true
  if (/^[\w-]+(\.[\w-]+)+([\/?#]|$)/.test(t)) return true
  return false
}

export function normalizeWebUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const href = trimmed.includes('://') ? trimmed : `https://${trimmed}`
    const url = new URL(href)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}

/** 网址直接打开；否则走默认搜索引擎 */
export function resolveWebInput(
  input: string,
  engine?: WebSearchEngine
): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (looksLikeUrl(trimmed)) {
    return normalizeWebUrl(trimmed)
  }
  return buildSearchUrl(trimmed, engine ?? pickDefaultSearchEngine())
}

export function webDisplayName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return '网页'
  }
}

export function computeWebCropScale(viewportWidth: number, crop: WebHorizontalCrop): number {
  const span = Math.max(crop.right - crop.left, WEB_CROP_MIN_SPAN)
  return viewportWidth / (span * WEB_PAGE_LAYOUT_WIDTH)
}
