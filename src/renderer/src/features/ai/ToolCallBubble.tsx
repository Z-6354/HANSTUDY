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
}

export function ToolCallBubble({ steps }: ToolCallBubbleProps): JSX.Element | null {
  if (steps.length === 0) return null
  return (
    <div className="ai-tool-steps">
      {steps.map((step) => (
        <div key={step.id} className={`ai-tool-step ai-tool-step--${step.status}`}>
          <span className="ai-tool-step-name">{step.name}</span>
          {step.status === 'running' && <span className="ai-tool-step-status">执行中…</span>}
          {step.status === 'done' && step.output && (
            <pre className="ai-tool-step-output">{step.output.slice(0, 400)}</pre>
          )}
          {step.status === 'error' && (
            <span className="ai-tool-step-error">{step.error ?? '失败'}</span>
          )}
        </div>
      ))}
    </div>
  )
}
