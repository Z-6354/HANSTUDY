/** BrowserView 边界计算（WebViewer 与回归测试共用） */

export interface WebGuestBounds {
  x: number
  y: number
  width: number
  height: number
}

export const WEB_LAYOUT_RAIL_GUTTER = 44

export function readWebGuestBounds(
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  rails: { left: boolean; right: boolean }
): WebGuestBounds {
  let x = rect.left
  let width = Math.max(Math.floor(rect.width), 64)
  if (rails.left) {
    x += WEB_LAYOUT_RAIL_GUTTER
    width = Math.max(width - WEB_LAYOUT_RAIL_GUTTER, 64)
  }
  if (rails.right) {
    width = Math.max(width - WEB_LAYOUT_RAIL_GUTTER, 64)
  }
  return {
    x,
    y: rect.top,
    width,
    height: Math.max(Math.floor(rect.height), 64)
  }
}

export function normalizeGuestBounds(bounds: WebGuestBounds): WebGuestBounds {
  return {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(64, Math.round(bounds.width)),
    height: Math.max(64, Math.round(bounds.height))
  }
}

/** 导航去重：忽略末尾斜杠差异 */
export function guestUrlsEquivalent(a: string, b: string): boolean {
  if (a === b) return true
  try {
    return new URL(a).href === new URL(b).href
  } catch {
    return false
  }
}

export function isBlankGuestUrl(url: string): boolean {
  return !url || url === 'about:blank'
}

export function isWebNavigableUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** 是否应对 guest 发起 loadURL（当前 URL 与目标不同） */
export function shouldStartGuestNavigation(current: string, target: string): boolean {
  if (!target.trim()) return false
  try {
    return new URL(current).href !== new URL(target).href
  } catch {
    return current !== target
  }
}
