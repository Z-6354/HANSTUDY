import type * as pdfjsLib from 'pdfjs-dist'

export interface PdfOutlineItem {
  title: string
  page: number | null
  level: number
  children: PdfOutlineItem[]
}

async function resolveOutlinePage(
  pdf: pdfjsLib.PDFDocumentProxy,
  dest: string | unknown[] | null | undefined
): Promise<number | null> {
  if (!dest) return null
  try {
    let explicitDest: unknown = dest
    if (typeof dest === 'string') {
      explicitDest = await pdf.getDestination(dest)
    }
    if (!Array.isArray(explicitDest) || !explicitDest[0]) return null
    const pageIndex = await pdf.getPageIndex(explicitDest[0] as Parameters<typeof pdf.getPageIndex>[0])
    return pageIndex + 1
  } catch {
    return null
  }
}

async function parseOutlineNodes(
  pdf: pdfjsLib.PDFDocumentProxy,
  nodes: Array<{ title: string; dest?: unknown; items?: unknown[] }> | null | undefined,
  level: number
): Promise<PdfOutlineItem[]> {
  if (!nodes?.length) return []
  const items: PdfOutlineItem[] = []
  for (const node of nodes) {
    const page = await resolveOutlinePage(
      pdf,
      (node.dest as string | unknown[] | null | undefined) ?? null
    )
    const children = await parseOutlineNodes(
      pdf,
      node.items as Array<{ title: string; dest?: unknown; items?: unknown[] }> | undefined,
      level + 1
    )
    items.push({
      title: node.title?.trim() || '（无标题）',
      page,
      level,
      children
    })
  }
  return items
}

export async function loadPdfOutline(
  pdf: pdfjsLib.PDFDocumentProxy
): Promise<PdfOutlineItem[]> {
  const raw = await pdf.getOutline()
  return parseOutlineNodes(pdf, raw, 0)
}

export function flattenPdfOutline(items: PdfOutlineItem[]): PdfOutlineItem[] {
  const flat: PdfOutlineItem[] = []
  const walk = (nodes: PdfOutlineItem[]): void => {
    for (const node of nodes) {
      flat.push(node)
      if (node.children.length) walk(node.children)
    }
  }
  walk(items)
  return flat
}
