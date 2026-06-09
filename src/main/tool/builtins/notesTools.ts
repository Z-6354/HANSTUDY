import type { ToolRegistry } from '../ToolRegistry'
import { BUILTIN_TOOLS } from '../../../shared/agent/tools'
import { MAX_AI_DOC_CONTEXT } from '../../../shared/documentContextExtract'
import { ensureNotesRoot, listNotesDirectory, readNote } from '../../infra/notesStore'
import { searchNotes } from '../../infra/notesSearchService'
import { createToolParameters, parseIntArg } from './schemaHelpers'

const MAX_READ_NOTE_CHARS = MAX_AI_DOC_CONTEXT

export function registerNotesTools(registry: ToolRegistry): void {
  registry.register({
    name: BUILTIN_TOOLS.listNotes,
    description: '列出笔记库目录下的 Markdown 笔记文件',
    parameters: createToolParameters([
      { name: 'dirPath', type: 'string', description: '笔记目录路径，省略则使用根目录', required: false }
    ]),
    handler: async (args) => {
      const dir = args.dirPath ? String(args.dirPath) : await ensureNotesRoot()
      registry.pathGuard.assertAllowed(dir)
      const items = await listNotesDirectory(dir)
      return { success: true, content: JSON.stringify(items, null, 2) }
    }
  })

  registry.register({
    name: BUILTIN_TOOLS.readNote,
    description:
      '读取笔记库中的 Markdown 笔记全文（对齐 hancli read_file 的笔记变体）；默认最多 12000 字符。',
    parameters: createToolParameters([
      { name: 'filePath', type: 'string', description: '笔记绝对路径（须在 userData/notes 下）', required: true }
    ]),
    handler: async (args) => {
      const filePath = String(args.filePath ?? '')
      registry.pathGuard.assertAllowed(filePath)
      const text = await readNote(filePath)
      const truncated = text.length > MAX_READ_NOTE_CHARS
      const content = truncated
        ? `${text.slice(0, MAX_READ_NOTE_CHARS)}\n\n…（笔记过长，已截断）`
        : text
      return { success: true, content }
    }
  })

  registry.register({
    name: BUILTIN_TOOLS.searchNotes,
    description:
      '在笔记库内按关键词搜索（大小写不敏感），返回路径、行号与匹配行（对齐 hancli grep_code 的笔记变体）。',
    parameters: createToolParameters([
      { name: 'query', type: 'string', description: '搜索关键词', required: true },
      { name: 'max_results', type: 'integer', description: '最多返回命中条数，默认 40', required: false },
      { name: 'max_files', type: 'integer', description: '最多扫描笔记文件数，默认 120', required: false }
    ]),
    handler: async (args) => {
      const query = String(args.query ?? '').trim()
      if (!query) {
        return { success: false, content: '', error: 'query 不能为空' }
      }
      const root = await ensureNotesRoot()
      registry.pathGuard.assertAllowed(root)
      const hits = await searchNotes({
        rootDir: root,
        query,
        maxResults: parseIntArg(args.max_results, 40),
        maxFiles: parseIntArg(args.max_files, 120)
      })
      if (!hits.length) {
        return { success: true, content: `笔记库中未找到包含「${query}」的匹配。` }
      }
      const lines = hits.map((h) => `${h.path}:${h.line}: ${h.text}`)
      return { success: true, content: lines.join('\n') }
    }
  })
}
