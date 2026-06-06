import { useEffect, useRef, useState } from 'react'
import { BookOpen, Bot, MessageCircle } from 'lucide-react'
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
    const close = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="chat-mode-selector" ref={ref}>
      <button
        type="button"
        className="chat-mode-trigger icon-btn"
        title={`æ¨¡å¼ï¼?{current.label}`}
        aria-label={`å½“å‰æ¨¡å¼ ${current.label}ï¼Œç‚¹å‡»åˆ‡æ¢`}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon icon={MODE_ICONS[mode]} size={16} />
      </button>
      {open && (
        <div className="chat-mode-menu">
          {CHAT_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
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
