import { useMemo } from 'react'
import { renderMarkdownHtml } from '../utils/markdown'

interface AIMessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  isError?: boolean
  children?: React.ReactNode
}

export function AIMessageBubble({
  role,
  content,
  isStreaming,
  isError,
  children
}: AIMessageBubbleProps): JSX.Element {
  const html = useMemo(
    () => (role === 'assistant' && !isError ? renderMarkdownHtml(content) : ''),
    [role, content, isError]
  )

  const showTyping = role === 'assistant' && isStreaming && !content.trim() && !isError
  const showStreamCursor =
    role === 'assistant' && isStreaming && content.trim().length > 0 && !isError

  return (
    <div className={`ai-bubble-row ai-bubble-row-${role}`}>
      <div className={`ai-bubble ai-bubble-${role}${isError ? ' ai-bubble-error' : ''}`}>
        {role === 'user' ? (
          <div className="ai-bubble-text">{content}</div>
        ) : isError ? (
          <div className="ai-bubble-text ai-bubble-error-text">{content}</div>
        ) : showTyping ? (
          <div className="ai-bubble-typing">
            <span className="ai-typing-dot" />
            <span className="ai-typing-dot" />
            <span className="ai-typing-dot" />
          </div>
        ) : (
          <div
            className={`ai-bubble-md markdown-preview ${showStreamCursor ? 'is-streaming' : ''}`}
            dangerouslySetInnerHTML={{ __html: html || '<p></p>' }}
          />
        )}
        {children && <div className="ai-bubble-actions">{children}</div>}
      </div>
    </div>
  )
}
