import { createRequire } from 'module'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { pathToFileURL } from 'url'
import { MAX_AI_DOC_CONTEXT } from '../../shared/documentContextExtract'
import { pageTextFromItems } from '../../shared/pdfTextFormat'

const require = createRequire(import.meta.url)

let workerReady = false

export interface PdfParseResult {
  text: string
  numPages: number
  startPage: number
  endPage: number
  truncated: boolean
}

async function loadPdfJs(): Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> {
  const pkgDir = dirname(require.resolve('pdfjs-dist/package.json'))
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  if (!workerReady) {
    const workerPath = join(pkgDir, 'legacy/build/pdf.worker.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
    workerReady = true
  }
  return pdfjs
}

async function openPdfDocument(filePath: string) {
  const pdfjs = await loadPdfJs()
  const buffer = await readFile(filePath)
  return pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
}

async function extractPageText(
  pdf: Awaited<ReturnType<typeof openPdfDocument>>,
  pageNo: number
): Promise<string> {
  const page = await pdf.getPage(pageNo)
  const content = await page.getTextContent()
  return pageTextFromItems(
    content.items as Array<{ str?: string; hasEOL?: boolean; transform?: number[] }>
  )
}

function formatPageBlock(pageNo: number, pageText: string): string | null {
  const trimmed = pageText.trim()
  if (!trimmed) return null
  return `--- 第 ${pageNo} 页 ---\n${trimmed}`
}

function truncatePdfText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_AI_DOC_CONTEXT) {
    return { text, truncated: false }
  }
  return {
    text: `${text.slice(0, MAX_AI_DOC_CONTEXT)}\n\n…（文档过长，已截断）`,
    truncated: true
  }
}

/** 获取 PDF 总页数 */
export async function getPdfPageCount(filePath: string): Promise<number> {
  const pdf = await openPdfDocument(filePath)
  try {
    return pdf.numPages
  } finally {
    await pdf.destroy()
  }
}

/** 按页范围提取 PDF 文本 */
export async function extractPdfPageRange(
  filePath: string,
  startPage: number,
  endPage: number
): Promise<PdfParseResult> {
  const pdf = await openPdfDocument(filePath)
  try {
    const numPages = pdf.numPages
    const start = Math.min(numPages, Math.max(1, Math.floor(startPage)))
    const end = Math.min(numPages, Math.max(start, Math.floor(endPage)))
    const parts: string[] = []

    for (let pageNo = start; pageNo <= end; pageNo++) {
      const pageText = await extractPageText(pdf, pageNo)
      const block = formatPageBlock(pageNo, pageText)
      if (block) parts.push(block)
    }

    const joined = parts.join('\n\n')
    const { text, truncated } = truncatePdfText(joined)
    return { text, numPages, startPage: start, endPage: end, truncated }
  } finally {
    await pdf.destroy()
  }
}

/** 解析 PDF：可指定页范围，省略时提取全文 */
export async function parsePdfDocument(
  filePath: string,
  options?: { startPage?: number; endPage?: number }
): Promise<PdfParseResult> {
  const numPages = await getPdfPageCount(filePath)
  const startPage = options?.startPage ?? 1
  const endPage = options?.endPage ?? numPages
  return extractPdfPageRange(filePath, startPage, endPage)
}

/** 从 PDF 文件提取纯文本（按页分隔，全文） */
export async function extractPdfText(filePath: string): Promise<string> {
  const result = await parsePdfDocument(filePath)
  return result.text
}
