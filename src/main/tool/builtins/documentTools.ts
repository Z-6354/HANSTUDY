import type { ToolRegistry } from '../ToolRegistry'
import { BUILTIN_TOOLS } from '../../../shared/agent/tools'
import { normalizePdfPageRange } from '../../../shared/pdfContextExtract'
import { readDocumentByLineRange } from '../../infra/documentRangeService'
import { getDocumentContext, readTextFile } from '../../infra/fileService'
import { getPdfPageCount, parsePdfDocument } from '../../infra/pdfTextService'
import { extname } from 'path'
import { createToolParameters, parseIntArg } from './schemaHelpers'

async function loadDocumentPlainText(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.txt' || ext === '.md') {
    return readTextFile(filePath)
  }
  const ctx = await getDocumentContext(filePath)
  return ctx.content
}

/** 文档读取与单篇检索（对齐 hancli registerFileTools 中的 read 类工具） */
export function registerDocumentTools(registry: ToolRegistry): void {
  registry.register({
    name: BUILTIN_TOOLS.readDocument,
    description:
      '读取指定路径的文档内容（txt/md/docx/pdf）；全文默认最多 12000 字符。大文件请改用 read_document_range 按行读取。',
    parameters: createToolParameters([
      { name: 'filePath', type: 'string', description: '文档绝对路径（须在 workspace/、.hanstudy/ 或已加载文件夹内）', required: true }
    ]),
    handler: async (args) => {
      const filePath = registry.pathGuard.resolveAllowed(String(args.filePath ?? ''))
      const text = await loadDocumentPlainText(filePath)
      return { success: true, content: text.slice(0, 12000) }
    }
  })

  registry.register({
    name: BUILTIN_TOOLS.parsePdf,
    description:
      '解析 PDF 文件并按页提取可读文本。适合按页精读；扫描件可能无文本。省略页码时解析全文（最多约 12000 字符）。',
    parameters: createToolParameters([
      { name: 'filePath', type: 'string', description: 'PDF 绝对路径', required: true },
      { name: 'startPage', type: 'integer', description: '起始页（1-based）；省略时从第 1 页', required: false },
      { name: 'endPage', type: 'integer', description: '结束页（含）；省略时到末页或 startPage', required: false }
    ]),
    handler: async (args) => {
      const filePath = registry.pathGuard.resolveAllowed(String(args.filePath ?? ''))
      if (extname(filePath).toLowerCase() !== '.pdf') {
        return { success: false, content: '', error: '仅支持 .pdf 文件' }
      }

      const numPages = await getPdfPageCount(filePath)
      const startArg = args.startPage != null ? parseIntArg(args.startPage, 1) : undefined
      const endArg = args.endPage != null ? parseIntArg(args.endPage, 1) : undefined

      let startPage = startArg ?? 1
      let endPage = endArg ?? (startArg != null ? startArg : numPages)
      if (startArg == null && endArg != null) startPage = 1
      const range = normalizePdfPageRange(startPage, endPage, numPages)

      const parsed = await parsePdfDocument(filePath, range)
      if (!parsed.text.trim()) {
        return {
          success: true,
          content:
            '（未能从 PDF 中提取可读文本，可能是扫描件或图片 PDF。）'
        }
      }

      const header =
        `# ${filePath.replace(/^.*[/\\]/, '')}（第 ${parsed.startPage}-${parsed.endPage} 页 / 共 ${parsed.numPages} 页` +
        `${parsed.truncated ? '，已截断' : ''}）\n\n`
      return { success: true, content: header + parsed.text }
    }
  })

  registry.register({
    name: BUILTIN_TOOLS.readDocumentRange,
    description:
      '按行读取文档片段（txt/md/docx/pdf 提取文本后分行）；offset 为 1-based 起始行，limit 默认 200、最大 2000 行。适合大文件分段阅读。',
    parameters: createToolParameters([
      { name: 'filePath', type: 'string', description: '文档绝对路径', required: true },
      { name: 'offset', type: 'integer', description: '起始行号，1 表示第一行；省略时从第 1 行开始', required: false },
      { name: 'limit', type: 'integer', description: '最多读取行数；省略时 200 行', required: false }
    ]),
    handler: async (args) => {
      const filePath = registry.pathGuard.resolveAllowed(String(args.filePath ?? ''))
      const offset = parseIntArg(args.offset, 1)
      const limit = parseIntArg(args.limit, 200)
      const result = await readDocumentByLineRange(filePath, offset, limit)
      const header =
        `# ${result.fileName}（行 ${result.startLine}-${result.endLine} / 共 ${result.totalLines} 行` +
        `${result.truncated ? '，后续还有内容' : ''}）\n\n`
      return { success: true, content: header + result.content }
    }
  })

  registry.register({
    name: BUILTIN_TOOLS.getDocumentContext,
    description: '获取文档上下文摘要（适合 PDF 或超长文档的全文概览，单次最多约 12000 字符）',
    parameters: createToolParameters([
      { name: 'filePath', type: 'string', description: '文档绝对路径', required: true }
    ]),
    handler: async (args) => {
      const filePath = registry.pathGuard.resolveAllowed(String(args.filePath ?? ''))
      const ctx = await getDocumentContext(filePath)
      return { success: true, content: JSON.stringify(ctx, null, 2) }
    }
  })

  registry.register({
    name: BUILTIN_TOOLS.searchInDocument,
    description: '在单篇文档文本中搜索关键词（大小写不敏感），返回行号与匹配行',
    parameters: createToolParameters([
      { name: 'filePath', type: 'string', description: '文档绝对路径', required: true },
      { name: 'query', type: 'string', description: '搜索关键词', required: true }
    ]),
    handler: async (args) => {
      const filePath = registry.pathGuard.resolveAllowed(String(args.filePath ?? ''))
      const query = String(args.query ?? '').toLowerCase()
      const text = await loadDocumentPlainText(filePath)
      const lines = text.split('\n')
      const hits: string[] = []
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.toLowerCase().includes(query)) {
          hits.push(`L${i + 1}: ${lines[i]!.trim()}`)
        }
        if (hits.length >= 20) break
      }
      return {
        success: true,
        content: hits.length ? hits.join('\n') : '未找到匹配'
      }
    }
  })
}
