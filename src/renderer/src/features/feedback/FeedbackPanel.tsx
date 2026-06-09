import { useCallback, useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { APP_NAME, APP_VERSION } from '@shared/appMeta'
import {
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
  validateFeedbackPayload
} from '@shared/feedback'

const CLIENT_ID_KEY = 'hanstudy-feedback-client-id'

function loadClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY)
    if (existing) return existing
    const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    localStorage.setItem(CLIENT_ID_KEY, id)
    return id
  } catch {
    return 'anonymous'
  }
}

export function FeedbackPanel(): JSX.Element {
  const [category, setCategory] = useState<FeedbackCategory>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [draftLoaded, setDraftLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('hanstudy-feedback-draft')
      if (raw) {
        const d = JSON.parse(raw) as {
          category?: FeedbackCategory
          title?: string
          description?: string
          contact?: string
        }
        if (d.category) setCategory(d.category)
        if (d.title) setTitle(d.title)
        if (d.description) setDescription(d.description)
        if (d.contact) setContact(d.contact)
      }
    } catch {
      // ignore
    }
    setDraftLoaded(true)
  }, [])

  useEffect(() => {
    if (!draftLoaded) return
    localStorage.setItem(
      'hanstudy-feedback-draft',
      JSON.stringify({ category, title, description, contact })
    )
  }, [category, title, description, contact, draftLoaded])

  const handleSubmit = useCallback(async (): Promise<void> => {
    setMessage(null)
    const err = validateFeedbackPayload({ category, title, description, contact })
    if (err) {
      setMessage({ kind: 'err', text: err })
      return
    }
    setSubmitting(true)
    try {
      const result = await window.api.feedback.submit({
        category,
        title,
        description,
        contact: contact.trim() || undefined,
        clientId: loadClientId()
      })
      if (result.ok) {
        setMessage({ kind: 'ok', text: result.message })
        setTitle('')
        setDescription('')
        localStorage.removeItem('hanstudy-feedback-draft')
      } else {
        setMessage({ kind: 'err', text: result.message })
      }
    } catch (e) {
      setMessage({
        kind: 'err',
        text: e instanceof Error ? e.message : '提交失败'
      })
    } finally {
      setSubmitting(false)
    }
  }, [category, title, description, contact])

  return (
    <div className="feedback-panel">
      <header className="feedback-header">
        <h2>提交反馈</h2>
        <p>
          向 {APP_NAME} 团队报告问题或提出建议。提交后将发送至服务器，经 Hermes 整合后通知维护者，并在反馈看板中展示处理状态。
        </p>
      </header>

      <form
        className="feedback-form"
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
      >
        <label className="feedback-field">
          <span>类型</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
          >
            {(Object.keys(FEEDBACK_CATEGORY_LABELS) as FeedbackCategory[]).map((key) => (
              <option key={key} value={key}>
                {FEEDBACK_CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        <label className="feedback-field">
          <span>标题</span>
          <input
            type="text"
            value={title}
            maxLength={120}
            placeholder="简要概括问题或建议"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="feedback-field">
          <span>详细描述</span>
          <textarea
            value={description}
            rows={10}
            placeholder={'请描述复现步骤、期望行为、截图说明等。\nBug 请尽量说明：做了什么 → 发生了什么 → 期望发生什么。'}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className="feedback-field">
          <span>联系方式（可选）</span>
          <input
            type="text"
            value={contact}
            maxLength={120}
            placeholder="邮箱或其它联系方式，便于跟进"
            onChange={(e) => setContact(e.target.value)}
          />
        </label>

        <p className="feedback-meta">
          客户端 v{APP_VERSION} · 草稿会自动保存在本地
        </p>

        {message && (
          <div className={`feedback-message feedback-message-${message.kind}`}>{message.text}</div>
        )}

        <button type="submit" className="primary-btn feedback-submit" disabled={submitting}>
          <Send size={14} aria-hidden />
          {submitting ? '提交中…' : '提交反馈'}
        </button>
      </form>
    </div>
  )
}
