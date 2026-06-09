import { getSystemPromptForMode } from '../../shared/chatModes'
import { formatDocumentContextHeader } from '../../shared/readingAssistant'
import type { ChatMode } from '../../shared/types'

export interface PromptAssemblyInput {
  chatMode: ChatMode
  skillExtra?: string
  documentContext?: { fileName: string; content: string; docPath?: string; hint?: string }
  contextText?: string
}

export class PromptAssembler {
  assembleSystem(input: PromptAssemblyInput): string {
    let system = getSystemPromptForMode(input.chatMode)
    if (input.skillExtra) {
      system = `${system}\n\n${input.skillExtra}`
    }
    if (input.chatMode === 'agent') {
      system +=
        '\n\n## 工具使用顺序\n' +
        '1. 跨文件/全库：list_library、glob_library 或 search_in_library\n' +
        '2. 精读：read_document_range、parse_pdf 或 get_document_context\n' +
        '3. 单篇内搜索：search_in_document（查目录/章节标题时用关键词如「目录」「一、」「二、」）\n' +
        '4. 笔记：list_notes、read_note、search_notes\n' +
        '5. 需要范式时：load_skill\n' +
        '基于工具返回结果作答，并标注来源。\n' +
        '## 效率\n' +
        '- 同一轮可并行调用多个工具（如 glob + parse_pdf 前几页）。\n' +
        '- 避免对同一文件重复 parse/search；目录/章节问题优先 parse_pdf 第 1–5 页或一次 search_in_document。\n' +
        '- 信息足够时立即用中文作答，不要无意义地继续调用工具。\n' +
        '## 回复要求\n' +
        '- **仅输出给用户的中文最终答案**；不要把英文推理、工具调用计划或「Let me…」类过程文字写入回复。\n' +
        '- 总结 PDF 结构时：先读目录/前几页或搜索章节标题，再归纳章数与主题。'
    }
    return system
  }

  buildContextMessages(input: PromptAssemblyInput): Array<{ role: 'user'; content: string }> {
    const out: Array<{ role: 'user'; content: string }> = []
    if (input.documentContext?.content) {
      const header = formatDocumentContextHeader(
        input.documentContext.fileName,
        input.documentContext.hint,
        input.documentContext.docPath
      )
      out.push({
        role: 'user',
        content: `以下是我加入对话的参考文档 ${header}：\n\n${input.documentContext.content}`
      })
    }
    if (input.contextText) {
      out.push({
        role: 'user',
        content:
          `以下是我选中的文档片段（回答时请引用所在位置，格式见 system 说明）：\n\n${input.contextText}`
      })
    }
    return out
  }
}
