/** 同名笔记本自动追加 (1)、(2)… */
export function uniqueNotebookName(desired: string, existingNames: readonly string[]): string {
  const trimmed = desired.trim()
  if (!trimmed) return trimmed

  const taken = new Set(existingNames.map((n) => n.trim()))
  if (!taken.has(trimmed)) return trimmed

  const suffixMatch = /^(.*) \((\d+)\)$/.exec(trimmed)
  const base = (suffixMatch ? suffixMatch[1] : trimmed).trimEnd()

  let n = 1
  while (taken.has(`${base} (${n})`)) n += 1
  return `${base} (${n})`
}
