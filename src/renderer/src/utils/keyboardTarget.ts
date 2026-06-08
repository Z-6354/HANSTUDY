/** 焦点是否在文本输入控件内（此时应使用原生 Ctrl+A / Ctrl+F 等行为） */
export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.closest('.monaco-editor')) return true

  const tag = target.tagName
  if (tag === 'TEXTAREA') return true
  if (tag !== 'INPUT') return false

  const type = (target as HTMLInputElement).type.toLowerCase()
  return type === 'text' || type === 'search' || type === 'password' || type === 'email' || type === 'url' || type === 'tel' || type === 'number' || type === ''
}
