/** 将 pdf.js getTextContent items 拼成按行文本 */
export function pageTextFromItems(
  items: Array<{ str?: string; hasEOL?: boolean; transform?: number[] }>
): string {
  const lines: string[] = []
  let line = ''
  let lastY: number | null = null

  for (const item of items) {
    if (typeof item.str !== 'string' || !item.str) continue
    const y = item.transform?.[5]
    if (lastY != null && y != null && Math.abs(y - lastY) > 4 && line.trim()) {
      lines.push(line.trim())
      line = ''
    }
    line += item.str
    if (item.hasEOL) {
      lines.push(line.trim())
      line = ''
    }
    if (y != null) lastY = y
  }
  if (line.trim()) lines.push(line.trim())
  return lines.join('\n')
}
