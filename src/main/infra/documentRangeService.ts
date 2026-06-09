import { getDocumentContext, readTextFile } from './fileService'
import { extname } from 'path'

export const MAX_READ_DOCUMENT_LINES = 2000
export const DEFAULT_READ_DOCUMENT_LINES = 200

export interface DocumentLineRangeResult {
  content: string
  startLine: number
  endLine: number
  totalLines: number
  truncated: boolean
  fileName: string
}

async function loadDocumentLines(filePath: string): Promise<{ lines: string[]; fileName: string }> {
  const ext = extname(filePath).toLowerCase()
  let text: string
  let fileName: string

  if (ext === '.txt' || ext === '.md') {
    text = await readTextFile(filePath)
    fileName = filePath.replace(/^.*[/\\]/, '')
  } else {
    const ctx = await getDocumentContext(filePath)
    text = ctx.content
    fileName = ctx.fileName
  }

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  return { lines, fileName }
}

/**
 * 按行读取文档片段（对齐 hancli read_file 的 offset/limit 语义）。
 * offset：1-based 起始行；limit：最多读取行数，上限 {@link MAX_READ_DOCUMENT_LINES}。
 */
export async function readDocumentByLineRange(
  filePath: string,
  offset = 1,
  limit = DEFAULT_READ_DOCUMENT_LINES
): Promise<DocumentLineRangeResult> {
  const startLine = Math.max(1, Math.floor(offset))
  const maxLines = clampLineLimit(limit)
  const { lines, fileName } = await loadDocumentLines(filePath)
  const totalLines = lines.length
  const startIdx = Math.min(startLine - 1, Math.max(0, totalLines - 1))
  const endIdx = Math.min(startIdx + maxLines, totalLines)
  const slice = lines.slice(startIdx, endIdx)
  const truncated = endIdx < totalLines

  return {
    content: slice.join('\n'),
    startLine: totalLines === 0 ? 1 : startIdx + 1,
    endLine: totalLines === 0 ? 0 : endIdx,
    totalLines,
    truncated,
    fileName
  }
}

function clampLineLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_READ_DOCUMENT_LINES
  return Math.min(Math.floor(limit), MAX_READ_DOCUMENT_LINES)
}
