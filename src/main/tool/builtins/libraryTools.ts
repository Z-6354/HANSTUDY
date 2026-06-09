import type { ToolRegistry } from '../ToolRegistry'
import { BUILTIN_TOOLS } from '../../../shared/agent/tools'
import { globLibraryFiles, listLibraryEntries, searchInLibrary } from '../../infra/libraryBrowseService'
import { getReadingProgress } from '../../infra/readingProgressService'
import { createToolParameters, parseBooleanArg, parseIntArg } from './schemaHelpers'

/** 资料库浏览与检索（对齐 hancli list_dir / grep_code 的资料库变体） */
export function registerLibraryTools(registry: ToolRegistry): void {
  registry.register({
    name: BUILTIN_TOOLS.listLibrary,
    description:
      '列出本地资料库目录内容。path 为资料库内相对子目录（省略则列根目录）；recursive 为 true 时递归列出支持的文档文件。跨文件任务请先调用本工具或 search_in_library 定位文件。',
    parameters: createToolParameters([
      { name: 'path', type: 'string', description: '资料库内相对路径，省略表示资料库根目录', required: false },
      { name: 'recursive', type: 'boolean', description: '是否递归列出文档文件，默认 false 仅列当前层', required: false },
      { name: 'max_entries', type: 'integer', description: '最多返回条目数，默认 200', required: false }
    ]),
    handler: async (args) => {
      const entries = await listLibraryEntries({
        path: args.path != null ? String(args.path) : undefined,
        recursive: parseBooleanArg(args.recursive, false),
        maxEntries: parseIntArg(args.max_entries, 200)
      })
      if (!entries.length) {
        return { success: true, content: '资料库目录为空或未找到支持的文档。' }
      }
      return { success: true, content: JSON.stringify(entries, null, 2) }
    }
  })

  registry.register({
    name: BUILTIN_TOOLS.globLibrary,
    description:
      '按文件名 glob 在资料库内查找文档（只读）；适合先定位候选文件，例如 **/*.pdf、**/*论文*。找到后再 read_document_range 或 parse_pdf 精读。',
    parameters: createToolParameters([
      { name: 'pattern', type: 'string', description: 'glob 模式，例如 **/*.pdf、**/*机器学习*', required: true },
      { name: 'path', type: 'string', description: '资料库内相对子目录，省略则搜全库', required: false },
      { name: 'max_results', type: 'integer', description: '最多返回结果数，默认 50，上限 200', required: false }
    ]),
    handler: async (args) => {
      const pattern = String(args.pattern ?? '').trim()
      if (!pattern) {
        return { success: false, content: '', error: 'pattern 不能为空' }
      }
      const matches = await globLibraryFiles({
        pattern,
        path: args.path != null ? String(args.path) : undefined,
        maxResults: parseIntArg(args.max_results, 50)
      })
      if (!matches.length) {
        return { success: true, content: `未找到匹配文件: ${pattern}` }
      }
      return { success: true, content: JSON.stringify(matches, null, 2) }
    }
  })

  registry.register({
    name: BUILTIN_TOOLS.searchInLibrary,
    description:
      '在本地资料库内按关键词搜索文档内容（大小写不敏感），返回文件路径、行号与匹配行。跨文件主题检索请优先使用本工具，再 read_document_range 精读。',
    parameters: createToolParameters([
      { name: 'query', type: 'string', description: '搜索关键词', required: true },
      { name: 'path', type: 'string', description: '限定在资料库内某子目录下搜索，省略则搜全库', required: false },
      { name: 'max_results', type: 'integer', description: '最多返回命中条数，默认 40', required: false },
      { name: 'max_files', type: 'integer', description: '最多扫描文件数，默认 120', required: false }
    ]),
    handler: async (args) => {
      const query = String(args.query ?? '').trim()
      if (!query) {
        return { success: false, content: '', error: 'query 不能为空' }
      }
      const hits = await searchInLibrary({
        query,
        path: args.path != null ? String(args.path) : undefined,
        maxResults: parseIntArg(args.max_results, 40),
        maxFiles: parseIntArg(args.max_files, 120)
      })
      if (!hits.length) {
        return { success: true, content: `资料库中未找到包含「${query}」的匹配。` }
      }
      const lines = hits.map((h) => `${h.path}:${h.line}: ${h.text}`)
      return { success: true, content: lines.join('\n') }
    }
  })

  registry.register({
    name: BUILTIN_TOOLS.getReadingProgress,
    description: '获取某文档的阅读进度（PDF 页码、TXT/MD 行号、最近阅读时间等）',
    parameters: createToolParameters([
      { name: 'filePath', type: 'string', description: '文档绝对路径', required: true }
    ]),
    handler: async (args) => {
      const filePath = String(args.filePath ?? '')
      registry.pathGuard.assertAllowed(filePath)
      const progress = await getReadingProgress(filePath)
      if (!progress) {
        return { success: true, content: JSON.stringify({ filePath, hasProgress: false }, null, 2) }
      }
      return { success: true, content: JSON.stringify({ hasProgress: true, ...progress }, null, 2) }
    }
  })
}
