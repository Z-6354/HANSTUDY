import { FileText, StickyNote } from 'lucide-react'
import type { ChatContextSnapshot } from '@shared/aiContext'
import {
  canNavigateContextSnapshot,
  formatContextChipLabel
} from '@shared/aiContext'

interface MessageContextChipsProps {
  items: ChatContextSnapshot[]
  onNavigate?: (item: ChatContextSnapshot) => void
  className?: string
}

export function MessageContextChips({
  items,
  onNavigate,
  className = ''
}: MessageContextChipsProps): JSX.Element | null {
  if (items.length === 0) return null

  return (
    <div className={`ai-message-context-chips ${className}`.trim()}>
      {items.map((item, index) => {
        const label = formatContextChipLabel(item)
        const clickable = Boolean(onNavigate) && canNavigateContextSnapshot(item)
        const key = item.noteEntryId ?? item.docPath ?? `${item.kind}-${index}`
        const inner = (
          <>
            {item.kind === 'note' ? (
              <StickyNote size={11} aria-hidden />
            ) : (
              <FileText size={11} aria-hidden />
            )}
            <span>{label}</span>
          </>
        )

        if (!clickable) {
          return (
            <span key={key} className="ai-message-context-chip" title={label}>
              {inner}
            </span>
          )
        }

        return (
          <button
            key={key}
            type="button"
            className="ai-message-context-chip ai-message-context-chip--clickable"
            title={`${label} · 点击跳转`}
            onClick={() => onNavigate?.(item)}
          >
            {inner}
          </button>
        )
      })}
    </div>
  )
}
