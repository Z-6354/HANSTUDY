export interface NoteFontSizeOption {
  label: string
  value: string
}

export interface NoteColorOption {
  label: string
  value: string
}

export const NOTE_FONT_SIZES: NoteFontSizeOption[] = [
  { label: '小', value: '12px' },
  { label: '默认', value: '14px' },
  { label: '大', value: '16px' },
  { label: '特大', value: '18px' }
]

export const NOTE_TEXT_COLORS: NoteColorOption[] = [
  { label: '默认', value: '' },
  { label: '红', value: '#c62828' },
  { label: '橙', value: '#ef6c00' },
  { label: '绿', value: '#2e7d32' },
  { label: '蓝', value: '#1565c0' },
  { label: '紫', value: '#6a1b9a' }
]

export const NOTE_HIGHLIGHT_COLORS: NoteColorOption[] = [
  { label: '黄', value: '#fff176' },
  { label: '绿', value: '#c5e1a5' },
  { label: '蓝', value: '#90caf9' },
  { label: '粉', value: '#f8bbd0' },
  { label: '灰', value: '#e0e0e0' }
]

/** 根据背景色选择可读性更好的前景色 */
export function contrastTextForBackground(color: string): string {
  const rgb = parseHexColor(color)
  if (!rgb) return '#212121'
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.62 ? '#212121' : '#fafafa'
}

function parseHexColor(color: string): { r: number; g: number; b: number } | null {
  const hex = color.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) return null
  const full =
    hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  }
}

export function noteHighlightStyle(backgroundColor: string): string {
  return `background-color: ${backgroundColor}; color: ${contrastTextForBackground(backgroundColor)}`
}

export function wrapNoteFontSize(size: string, selected: string): string {
  return `<span style="font-size: ${size}">${selected}</span>`
}

export function wrapNoteTextColor(color: string, selected: string): string {
  if (!color) return selected
  return `<span style="color: ${color}">${selected}</span>`
}

export function wrapNoteHighlight(color: string, selected: string): string {
  return `<mark style="${noteHighlightStyle(color)}">${selected}</mark>`
}
