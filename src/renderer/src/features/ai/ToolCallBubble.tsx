import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, XCircle } from 'lucide-react'
import { formatToolDisplayName } from '@shared/agent/tools'

export interface ToolStep {
  /** LLM tool_call_id，用于 start/done 精确配对 */
  id: string
  name: string
  status: 'running' | 'done' | 'error'
  output?: string
  error?: string
}

interface ToolCallBubbleProps {
  steps: ToolStep[]
  /** 流式进行中：不展示工具原始输出 */
  compact?: boolean
}

function StepIcon({ status }: { status: ToolStep['status'] }): JSX.Element {
  if (status === 'running') {
    return <Loader2 size={14} className="ai-tool-step-icon ai-tool-step-icon--spin" aria-hidden />
  }
  if (status === 'error') {
    return <XCircle size={14} className="ai-tool-step-icon ai-tool-step-icon--error" aria-hidden />
  }
  return <CheckCircle2 size={14} className="ai-tool-step-icon ai-tool-step-icon--done" aria-hidden />
}

export function ToolCallBubble({ steps, compact = false }: ToolCallBubbleProps): JSX.Element | null {
  const [showAllSteps, setShowAllSteps] = useState(false)
  const [expandedOutputs, setExpandedOutputs] = useState<Set<string>>(new Set())

  if (steps.length === 0) return null

  const running = steps.filter((s) => s.status === 'running')
  const visibleSteps = showAllSteps || steps.length <= 1 ? steps : [steps[steps.length - 1]!]
  const hiddenCount = steps.length - visibleSteps.length

  const headline =
    running.length > 0
      ? `正在调用工具（${running.length}/${steps.length}）…`
      : `已调用 ${steps.length} 个工具`

  const toggleOutput = (id: string): void => {
    setExpandedOutputs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="ai-tool-steps" role="status" aria-live="polite">
      <div className="ai-tool-steps-headline">{headline}</div>

      {!showAllSteps && hiddenCount > 0 && (
        <button
          type="button"
          className="ai-tool-steps-expand-btn"
          onClick={() => setShowAllSteps(true)}
        >
          <ChevronDown size={14} aria-hidden />
          展开全部 {steps.length} 个工具（当前显示最新 1 条）
        </button>
      )}

      {showAllSteps && steps.length > 1 && (
        <button
          type="button"
          className="ai-tool-steps-expand-btn"
          onClick={() => setShowAllSteps(false)}
        >
          <ChevronRight size={14} aria-hidden />
          仅显示最新工具
        </button>
      )}

      {visibleSteps.map((step) => {
        const hasOutput = Boolean(step.output?.trim())
        const outputOpen = expandedOutputs.has(step.id)
        return (
          <div key={step.id} className={`ai-tool-step ai-tool-step--${step.status}`}>
            <div className="ai-tool-step-row">
              <StepIcon status={step.status} />
              <span className="ai-tool-step-name">{formatToolDisplayName(step.name)}</span>
              {step.status === 'running' && <span className="ai-tool-step-status">执行中…</span>}
              {step.status === 'done' && (
                <span className="ai-tool-step-status ai-tool-step-status--done">完成</span>
              )}
              {step.status === 'error' && (
                <span className="ai-tool-step-error">{step.error ?? '失败'}</span>
              )}
              {!compact && hasOutput && step.status === 'done' && (
                <button
                  type="button"
                  className="ai-tool-step-output-toggle"
                  onClick={() => toggleOutput(step.id)}
                >
                  {outputOpen ? '收起输出' : '查看输出'}
                </button>
              )}
            </div>
            {!compact && outputOpen && hasOutput && step.status === 'done' && (
              <pre className="ai-tool-step-output">{step.output!.slice(0, 800)}</pre>
            )}
          </div>
        )
      })}
    </div>
  )
}
