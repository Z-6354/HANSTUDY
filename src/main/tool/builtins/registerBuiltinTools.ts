import type { ToolRegistry } from '../ToolRegistry'
import { BUILTIN_TOOLS } from '../../../shared/agent/tools'
import { getDocumentContext, readTextFile } from '../../infra/fileService'
import { loadSkillBody } from '../../skill/skillService'
import { ensureNotesRoot, listNotesDirectory } from '../../infra/notesStore'

export function registerBuiltinTools(registry: ToolRegistry): void {
  registry.register({
    name: BUILTIN_TOOLS.readDocument,
    description: '读取指定路径的文本类文档内容（txt/md/docx），PDF 返回提取摘要',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: '文档绝对路径' }
      },
      required: ['filePath']
    },
    handler: async (args) => {
      const filePath = String(args.filePath ?? '')
      registry.pathGuard.assertAllowed(filePath)
      const text = await readTextFile(filePath)
      return { success: true, content: text.slice(0, 12000) }
    }
  })

  registry.register({
    name: BUILTIN_TOOLS.getDocumentContext,
    description: '获取文档上下文摘要（适合 PDF 或超长文档）',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: '文档绝对路径' }
      },
      required: ['filePath']
    },
    handler: async (args) => {
      const filePath = String(args.filePath ?? '')
      registry.pathGuard.assertAllowed(filePath)
      const ctx = await getDocumentContext(filePath)
      return { success: true, content: JSON.stringify(ctx, null, 2) }
    }
  })

  registry.register({
    name: BUILTIN_TOOLS.listNotes,
    description: '列出笔记库目录下的 Markdown 笔记文件',
    parameters: {
      type: 'object',
      properties: {
        dirPath: { type: 'string', description: '笔记目录路径，省略则使用根目录' }
      }
    },
    handler: async (args) => {
      const dir = args.dirPath ? String(args.dirPath) : await ensureNotesRoot()
      registry.pathGuard.assertAllowed(dir)
      const items = await listNotesDirectory(dir)
      return { success: true, content: JSON.stringify(items, null, 2) }
    }
  })

  registry.register({
    name: BUILTIN_TOOLS.loadSkill,
    description: '按需加载 Skill 完整正文到上下文',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Skill 名称' }
      },
      required: ['name']
    },
    handler: async (args) => {
      const name = String(args.name ?? '')
      const body = await loadSkillBody(name)
      if (!body) return { success: false, content: '', error: `Skill 不存在或未启用: ${name}` }
      return { success: true, content: body }
    }
  })

  registry.register({
    name: BUILTIN_TOOLS.searchInDocument,
    description: '在文档文本中搜索关键词（大小写不敏感）',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string' },
        query: { type: 'string' }
      },
      required: ['filePath', 'query']
    },
    handler: async (args) => {
      const filePath = String(args.filePath ?? '')
      const query = String(args.query ?? '').toLowerCase()
      registry.pathGuard.assertAllowed(filePath)
      const text = await readTextFile(filePath)
      const lines = text.split('\n')
      const hits: string[] = []
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(query)) {
          hits.push(`L${i + 1}: ${lines[i].trim()}`)
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
