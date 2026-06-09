import { useMemo } from 'react'
import type { ChatContextSnapshot } from '@shared/aiContext'
import type { ChatImageAttachment } from '@shared/types'
import { renderMarkdownHtml } from '../../utils/markdown'
import { MessageContextChips } from './MessageContextChips'

interface AIMessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  images?: ChatImageAttachment[]
  isStreaming?: boolean
  isError?: boolean
  contextItems?: ChatContextSnapshot[]
  onContextItemNavigate?: (item: ChatContextSnapshot) => void
  children?: React.ReactNode
  onContextMenu?: (e: React.MouseEvent) => void
}

export function AIMessageBubble({
  role,
  content,
  images,
  isStreaming,
  isError,
  contextItems,
  onContextItemNavigate,
  children,
  onContextMenu
}: AIMessageBubbleProps): JSX.Element {
  const html = useMemo(
    () => (role === 'assistant' && !isError ? renderMarkdownHtml(content) : ''),
    [role, content, isError]
  )

  const showTyping = role === 'assistant' && isStreaming && !content.trim() && !isError
  const showStreamCursor =
    role === 'assistant' && isStreaming && content.trim().length > 0 && !isError

  return (
    <div className={`ai-bubble-row ai-bubble-row-${role}`} onContextMenu={onContextMenu}>
      <div className={`ai-bubble ai-bubble-${role}${isError ? ' ai-bubble-error' : ''}`}>
        {role === 'user' ? (
          <>
            {content.trim() && <div className="ai-bubble-text">{content}</div>}
            {images && images.length > 0 && (
              <div className="ai-bubble-images">
                {images.map((img) => (
                  <img
                    key={img.id}
                    className="ai-bubble-image"
                    src={img.dataUrl}
                    alt={img.name ?? '用户发送的图片'}
                    title={img.name}
                  />
                ))}
              </div>
            )}
          </>
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
        {role === 'user' && contextItems && contextItems.length > 0 && (
          <MessageContextChips
            items={contextItems}
            onNavigate={onContextItemNavigate}
            className="ai-message-context-chips--below"
          />
        )}
        {children && <div className="ai-bubble-actions">{children}</div>}
      </div>
    </div>
  )
}
