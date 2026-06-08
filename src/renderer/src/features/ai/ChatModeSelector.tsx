import { useEffect, useRef, useState } from 'react'
import { BookOpen, Bot, ChevronDown, MessageCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CHAT_MODES } from '@shared/chatModes'
import type { ChatMode } from '@shared/types'
import { Icon } from '../../components/IconButton'

const MODE_ICONS: Record<ChatMode, LucideIcon> = {
  chat: MessageCircle,
  agent: Bot,
  reading: BookOpen
}

interface ChatModeSelectorProps {
  mode: ChatMode
  onChange: (mode: ChatMode) => void
}

export function ChatModeSelector({ mode, onChange }: ChatModeSelectorProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = CHAT_MODES.find((m) => m.id === mode) ?? CHAT_MODES[0]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="chat-mode-selector" ref={ref}>
      <button
        type="button"
        className="chat-mode-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`当前模式：${current.label}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon icon={MODE_ICONS[mode]} size={14} />
        <span className="chat-mode-trigger-label">{current.label}</span>
        <ChevronDown size={12} className={`chat-mode-trigger-chevron${open ? ' open' : ''}`} />
      </button>
      {open && (
        <div className="chat-mode-menu" role="listbox" aria-label="选择 AI 模式">
          {CHAT_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === mode}
              className={`chat-mode-option ${item.id === mode ? 'active' : ''}`}
              onClick={() => {
                onChange(item.id)
                setOpen(false)
              }}
            >
              <Icon icon={MODE_ICONS[item.id]} size={16} />
              <span className="chat-mode-option-text">
                <span className="chat-mode-option-label">{item.label}</span>
                <span className="chat-mode-option-desc">{item.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
