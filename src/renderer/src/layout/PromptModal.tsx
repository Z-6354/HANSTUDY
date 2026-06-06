import { useState } from 'react'

interface PromptModalProps {
  title: string
  label: string
  defaultValue?: string
  placeholder?: string
  error?: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function PromptModal({
  title,
  label,
  defaultValue = '',
  placeholder,
  error,
  onSubmit,
  onCancel
}: PromptModalProps): JSX.Element {
  const [value, setValue] = useState(defaultValue)

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <label>
          {label}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit(value)
              if (e.key === 'Escape') onCancel()
            }}
          />
        </label>
        {error && <p className="settings-msg settings-warn">{error}</p>}
        <div className="modal-actions">
          <button className="secondary-btn" onClick={onCancel}>
            取消
          </button>
          <button className="primary-btn" onClick={() => onSubmit(value)}>
            确定
          </button>
        </div>
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel
}: ConfirmModalProps): JSX.Element {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="modal-actions">
          <button className="secondary-btn" onClick={onCancel}>
            取消
          </button>
          <button className="primary-btn danger-btn" onClick={onConfirm}>
            删除
          </button>
        </div>
      </div>
    </div>
  )
}
