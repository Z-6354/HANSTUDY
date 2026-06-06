import { useWorkspaceStore } from '../../../stores/workspaceStore'
import type { Annotation } from '../../../types/global.d'

/** 高亮背景透明度：保证文字可读 */
export const HIGHLIGHT_BG_ALPHA = 0.24

/** 默认高亮：淡黄半透明 */
export const FALLBACK_HIGHLIGHT = 'rgba(255, 237, 106, 0.24)'
const FALLBACK_UNDERLINE = '#007acc'

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace('#', '').trim()
  if (raw.length === 3) {
    return {
      r: parseInt(raw[0] + raw[0], 16),
      g: parseInt(raw[1] + raw[1], 16),
      b: parseInt(raw[2] + raw[2], 16)
    }
  }
  if (raw.length === 6) {
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16)
    }
  }
  return null
}

/** 实色 / 不透明色 → 半透明高亮背景，避免盖住文字 */
export function toHighlightBackground(color: string, alpha = HIGHLIGHT_BG_ALPHA): string {
  const trimmed = color.trim()
  if (!trimmed) return FALLBACK_HIGHLIGHT

  const rgbaMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(
    trimmed
  )
  if (rgbaMatch) {
    const r = Number(rgbaMatch[1])
    const g = Number(rgbaMatch[2])
    const b = Number(rgbaMatch[3])
    const existingAlpha = rgbaMatch[4] != null ? Number(rgbaMatch[4]) : 1
    const a = Math.min(existingAlpha, alpha)
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  if (trimmed.startsWith('#')) {
    const rgb = parseHex(trimmed)
    if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
  }

  return FALLBACK_HIGHLIGHT
}

/** 从工具栏取色，用于新建文本标注 */
export function resolveMarkupColor(type: 'highlight' | 'underline' | 'note'): string {
  const color = useWorkspaceStore.getState().annotationColor
  if (type === 'underline') return color || FALLBACK_UNDERLINE
  if (type === 'highlight') return toHighlightBackground(color || FALLBACK_HIGHLIGHT)
  return color || '#ffd500'
}

export function resolveStoredMarkupColor(
  ann: Pick<Annotation, 'type' | 'color'>,
  fallback?: string
): string {
  if (ann.type === 'highlight') {
    if (ann.color) return toHighlightBackground(ann.color)
    return fallback ?? FALLBACK_HIGHLIGHT
  }
  if (ann.color) return ann.color
  if (ann.type === 'underline') return fallback ?? FALLBACK_UNDERLINE
  return fallback ?? '#ffd500'
}
