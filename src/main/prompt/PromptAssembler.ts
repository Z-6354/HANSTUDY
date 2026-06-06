import { getSystemPromptForMode } from '../../shared/chatModes'
import type { ChatMode } from '../../shared/types'

export interface PromptAssemblyInput {
  chatMode: ChatMode
  skillExtra?: string
  documentContext?: { fileName: string; content: string }
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
        '\n\n你可以使用提供的工具读取文档、检索标注、加载 Skill。' +
        '需要信息时先调用工具，再基于结果回答。'
    }
    return system
  }

  buildContextMessages(input: PromptAssemblyInput): Array<{ role: 'user'; content: string }> {
    const out: Array<{ role: 'user'; content: string }> = []
    if (input.documentContext?.content) {
      out.push({
        role: 'user',
        content: `以下是我加入对话的参考文档「${input.documentContext.fileName}」：\n\n${input.documentContext.content}`
      })
    }
    if (input.contextText) {
      out.push({
        role: 'user',
        content: `以下是我选中的文档片段：\n\n${input.contextText}`
      })
    }
    return out
  }
}
