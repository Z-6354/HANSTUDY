import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE, APP_VERSION } from '@shared/appMeta'

interface AboutModalProps {
  onClose: () => void
}

export function AboutModal({ onClose }: AboutModalProps): JSX.Element {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card about-modal" onClick={(e) => e.stopPropagation()}>
        <div className="about-modal-header">
          <h3>{APP_NAME}</h3>
          <p className="about-tagline">{APP_TAGLINE}</p>
        </div>
        <p className="about-version">版本 {APP_VERSION}</p>
        <p className="about-desc">{APP_DESCRIPTION}</p>
        <ul className="about-features">
          <li>多格式阅读：TXT · Markdown · PDF · Word · 网页</li>
          <li>笔记本与 AI 对话互引，边读边记边问</li>
          <li>Skill 扩展与多会话历史</li>
        </ul>
        <p className="about-meta">Electron + React · MIT License</p>
        <div className="modal-actions">
          <button className="primary-btn" onClick={onClose}>
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
