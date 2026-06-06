import { createRequire } from 'module'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { pageTextFromItems } from '../../shared/pdfTextFormat'

const require = createRequire(import.meta.url)

let workerReady = false

async function loadPdfJs(): Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> {
  const pkgDir = dirname(require.resolve('pdfjs-dist/package.json'))
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  if (!workerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = join(pkgDir, 'legacy/build/pdf.worker.mjs')
    workerReady = true
  }
  return pdfjs
}

/** 从 PDF 文件提取纯文本（按页分隔） */
export async function extractPdfText(filePath: string): Promise<string> {
  const pdfjs = await loadPdfJs()
  const buffer = await readFile(filePath)
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise

  try {
    const parts: string[] = []
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo)
      const content = await page.getTextContent()
      const pageText = pageTextFromItems(
        content.items as Array<{ str?: string; hasEOL?: boolean; transform?: number[] }>
      )
      if (pageText.trim()) {
        parts.push(`--- 第 ${pageNo} 页 ---\n${pageText}`)
      }
    }
    return parts.join('\n\n')
  } finally {
    await pdf.destroy()
  }
}
