import type { ToolInvocation } from '../../shared/agent/tools'

import type { HitlToolRegistry } from '../hitl/HitlToolRegistry'

import type { LlmClient, LlmMessage } from '../llm/LlmClient'

import { PromptAssembler } from '../prompt/PromptAssembler'

import { resolveSkillsForChat } from '../skill/skillService'



export interface AgentTurnRequest {

  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>

  contextText?: string

  documentContext?: { fileName: string; content: string }

  excludedSkills?: string[]

  chatRequestId: string

}



export interface AgentCallbacks {

  onChunk: (text: string) => void

  onToolStart: (toolCallId: string, name: string, args: Record<string, unknown>) => void

  onToolDone: (toolCallId: string, name: string, output: string, error?: string) => void

}



const MAX_ITERATIONS = 8



export class Agent {

  private readonly promptAssembler = new PromptAssembler()



  constructor(

    private readonly llm: LlmClient,

    private readonly tools: HitlToolRegistry

  ) {}



  async runTurn(

    request: AgentTurnRequest,

    callbacks: AgentCallbacks,

    signal: AbortSignal

  ): Promise<{ text: string; activeSkills: Array<{ name: string; description: string }> }> {

    const lastUser =

      [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? ''

    const skillContext = await resolveSkillsForChat(lastUser, 'agent', request.excludedSkills)



    const system = this.promptAssembler.assembleSystem({

      chatMode: 'agent',

      skillExtra: skillContext.systemPromptExtra,

      documentContext: request.documentContext,

      contextText: request.contextText

    })



    const llmMessages: LlmMessage[] = [

      { role: 'system', content: system },

      ...this.promptAssembler.buildContextMessages({

        chatMode: 'agent',

        documentContext: request.documentContext,

        contextText: request.contextText

      }),

      ...request.messages

        .filter((m) => m.role !== 'system')

        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    ]



    const schemas = this.tools.getOpenAiSchemas()

    let iteration = 0

    let finalText = ''



    while (iteration < MAX_ITERATIONS) {

      iteration++

      if (signal.aborted) break



      const result = await this.llm.completeWithTools(llmMessages, schemas, signal)



      if (result.toolCalls.length === 0) {

        finalText = result.content

        if (finalText) callbacks.onChunk(finalText)

        break

      }



      if (result.content) {

        callbacks.onChunk(result.content)

      }



      llmMessages.push({

        role: 'assistant',

        content: result.content || null,

        tool_calls: result.toolCalls.map((tc) => ({

          id: tc.id,

          type: 'function' as const,

          function: { name: tc.name, arguments: tc.arguments }

        }))

      })



      const invocations: ToolInvocation[] = result.toolCalls.map((tc) => {

        let args: Record<string, unknown> = {}

        try {

          args = JSON.parse(tc.arguments || '{}') as Record<string, unknown>

        } catch {

          args = {}

        }

        return { id: tc.id, name: tc.name, arguments: args }

      })



      const outputs = await this.tools.executeTools(

        invocations,

        request.chatRequestId,

        4,

        (inv) => callbacks.onToolStart(inv.id, inv.name, inv.arguments ?? {}),

        (inv, out) => callbacks.onToolDone(inv.id, inv.name, out.content, out.error),

        signal

      )

      for (let i = 0; i < invocations.length; i++) {

        const inv = invocations[i]

        const out = outputs[i]

        llmMessages.push({

          role: 'tool',

          tool_call_id: inv.id,

          name: inv.name,

          content: out.error ? `错误: ${out.error}` : out.content

        })

      }

    }



    if (!finalText && iteration >= MAX_ITERATIONS) {

      finalText = '已达到最大推理步数，请简化问题后重试。'

      callbacks.onChunk(finalText)

    }



    if (signal.aborted) {

      const err = new Error('Aborted')

      err.name = 'AbortError'

      throw err

    }



    return { text: finalText, activeSkills: skillContext.meta.activeSkills }

  }

}


