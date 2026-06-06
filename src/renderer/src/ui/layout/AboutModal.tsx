interface AboutModalProps {
  onClose: () => void
}

export function AboutModal({ onClose }: AboutModalProps): JSX.Element {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card about-modal" onClick={(e) => e.stopPropagation()}>
        <h3>HAN Study Reader</h3>
        <p className="about-version">版本 0.1.0</p>
        <p className="about-desc">
          文档阅读器：支持 TXT、Markdown、PDF、Word 与网页资料，集成标注、笔记与 AI 助手。
        </p>
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
