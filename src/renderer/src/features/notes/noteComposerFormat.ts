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
  { label: '红', value: '#e53935' },
  { label: '橙', value: '#fb8c00' },
  { label: '绿', value: '#43a047' },
  { label: '蓝', value: '#1e88e5' },
  { label: '紫', value: '#8e24aa' }
]

export const NOTE_HIGHLIGHT_COLORS: NoteColorOption[] = [
  { label: '黄', value: '#fff59d' },
  { label: '绿', value: '#c8e6c9' },
  { label: '蓝', value: '#bbdefb' },
  { label: '粉', value: '#f8bbd0' },
  { label: '灰', value: '#eeeeee' }
]

export function wrapNoteFontSize(size: string, selected: string): string {
  return `<span style="font-size: ${size}">${selected}</span>`
}

export function wrapNoteTextColor(color: string, selected: string): string {
  if (!color) return selected
  return `<span style="color: ${color}">${selected}</span>`
}

export function wrapNoteHighlight(color: string, selected: string): string {
  return `<mark style="background-color: ${color}">${selected}</mark>`
}
