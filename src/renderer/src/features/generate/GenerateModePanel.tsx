import { Trash2 } from 'lucide-react'
import { useCallback, useMemo, useRef } from 'react'
import { IconButton } from '../../components/IconButton'
import { buildMdPreviewHtml } from '../reader/viewers/mdPreview'
import { useGenerateDraft } from './useGenerateDraft'
export function GenerateModePanel(): JSX.Element {
  const { title, body, setTitle, setBody, clearDraft, savedHint } = useGenerateDraft()
  const previewRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const bodyPreviewHtml = useMemo(() => {
    if (!body.trim()) return ''
    return buildMdPreviewHtml(body)
  }, [body])

  const wordCount = useMemo(() => {
    const text = `${title} ${body}`.replace(/\s+/g, '')
    return text.length
  }, [title, body])

  const handleClear = useCallback((): void => {
    if (!title.trim() && !body.trim()) return
    const ok = window.confirm('确定清空当前草稿？此操作不可撤销。')
    if (!ok) return
    clearDraft()
    inputRef.current?.focus()
  }, [body, clearDraft, title])

  const syncPreviewScroll = useCallback((): void => {
    const input = inputRef.current
    const preview = previewRef.current
    if (!input || !preview) return
    preview.scrollTop = input.scrollTop
  }, [])

  return (
    <div className="generate-mode-panel">
      <header className="generate-mode-toolbar">
        <div className="generate-mode-toolbar-left">
          <span className="generate-mode-label">生成</span>
          <span className="generate-mode-doc-chip">Markdown · 实时渲染</span>
        </div>
        <div className="generate-mode-toolbar-right">
          <span className="generate-mode-meta">{wordCount} 字</span>
          <span className="generate-mode-meta">{savedHint ? '已保存' : '保存中…'}</span>
          <IconButton
            icon={Trash2}
            label="清空草稿"
            className="generate-mode-icon-btn"
            size={14}
            onClick={handleClear}
          />
        </div>
      </header>

      <div className="generate-mode-workspace generate-mode-workspace--live">
        <div className="generate-mode-editor-pane">
          <div className="generate-mode-doc-sheet generate-mode-doc-sheet--live">
            <input
              type="text"
              className="generate-mode-title"
              placeholder="请输入标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div
              className="generate-live-markdown"
              onClick={() => inputRef.current?.focus()}
            >
              <article
                ref={previewRef}
                className="markdown-preview generate-mode-preview generate-live-markdown-preview"
                aria-hidden
                dangerouslySetInnerHTML={{
                  __html:
                    bodyPreviewHtml ||
                    '<p class="generate-live-markdown-placeholder">开始写作… 支持 **粗体**、# 标题、列表等 Markdown 语法</p>'
                }}
              />
              <textarea
                ref={inputRef}
                className="generate-live-markdown-input"
                value={body}
                placeholder=""
                spellCheck={false}
                onChange={(e) => setBody(e.target.value)}
                onScroll={syncPreviewScroll}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
