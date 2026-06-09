import type { ChatApiMessage } from '../../shared/chatPayload'
import { extractMessageText } from '../../shared/chatPayload'
import type { ToolInvocation } from '../../shared/agent/tools'
import {
  AGENT_MAX_ITERATIONS_SYNTHESIS_PROMPT,
  MAX_AGENT_ITERATIONS
} from '../../shared/agent/agentLimits'
import type { HitlToolRegistry } from '../hitl/HitlToolRegistry'
import type { LlmClient, LlmMessage } from '../llm/LlmClient'
import { appLogger } from '../logging/AppFileLogger'
import { PromptAssembler } from '../prompt/PromptAssembler'
import {
  beginSkillContext,
  drainSkillContext,
  endSkillContext,
  resolveSkillsForChat
} from '../skill/skillService'

export interface AgentTurnRequest {
  messages: ChatApiMessage[]
  contextText?: string
  documentContext?: {
    fileName: string
    content: string
    docPath?: string
    hint?: string
  }
  excludedSkills?: string[]
  chatRequestId: string
}

export interface AgentCallbacks {
  onChunk: (text: string) => void
  onToolStart: (toolCallId: string, name: string, args: Record<string, unknown>) => void
  onToolDone: (toolCallId: string, name: string, output: string, error?: string) => void
}

const MAX_ITERATIONS = MAX_AGENT_ITERATIONS

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
    const lastUser = extractMessageText(
      [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
    )
    beginSkillContext(request.chatRequestId)
    try {
      return await this.runTurnInner(request, callbacks, signal, lastUser)
    } finally {
      endSkillContext(request.chatRequestId)
    }
  }

  private async runTurnInner(
    request: AgentTurnRequest,
    callbacks: AgentCallbacks,
    signal: AbortSignal,
    lastUser: string
  ): Promise<{ text: string; activeSkills: Array<{ name: string; description: string }> }> {
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
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))
    ]

    const schemas = this.tools.getOpenAiSchemas()
    appLogger.info('agent', `turn start request=${request.chatRequestId}`)
    let iteration = 0
    let finalText = ''
    let answerStreamed = false

    while (iteration < MAX_ITERATIONS) {
      iteration++
      if (signal.aborted) break

      let iterationStreamed = false
      let iterationBuffer = ''
      const result = await this.llm.completeWithTools(
        llmMessages,
        schemas,
        signal,
        (chunk) => {
          iterationStreamed = true
          iterationBuffer += chunk
        }
      )

      if (result.toolCalls.length === 0) {
        finalText = result.content || iterationBuffer
        if (iterationBuffer) {
          answerStreamed = true
          callbacks.onChunk(iterationBuffer)
        } else if (finalText && !iterationStreamed) {
          answerStreamed = true
          callbacks.onChunk(finalText)
        }
        break
      }

      iterationBuffer = ''

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

      const skillBodies = drainSkillContext(request.chatRequestId)
      if (skillBodies) {
        llmMessages.push({
          role: 'user',
          content: skillBodies
        })
      }
    }

    if (!finalText && iteration >= MAX_ITERATIONS) {
      appLogger.warn('agent', `max iterations (${MAX_ITERATIONS}) request=${request.chatRequestId}`)
      llmMessages.push({
        role: 'user',
        content: AGENT_MAX_ITERATIONS_SYNTHESIS_PROMPT
      })
      finalText = await this.llm.streamChat(
        llmMessages,
        (chunk) => {
          answerStreamed = true
          callbacks.onChunk(chunk)
        },
        signal
      )
    }

    if (signal.aborted) {
      const err = new Error('Aborted')
      err.name = 'AbortError'
      throw err
    }

    return { text: finalText, activeSkills: skillContext.meta.activeSkills }
  }
}
