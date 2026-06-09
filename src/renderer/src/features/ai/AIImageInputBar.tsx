import { ImagePlus, Loader2, Scissors, X } from 'lucide-react'
import type { ChatImageAttachment } from '@shared/types'
import { MAX_CHAT_IMAGES } from '@shared/chatPayload'
import { IconButton } from '../../components/IconButton'

interface AIImageInputBarProps {
  images: ChatImageAttachment[]
  disabled?: boolean
  busy?: boolean
  onUpload: () => void
  onScreenshot: () => void
  onRemove: (id: string) => void
}

export function AIImageInputBar({
  images,
  disabled,
  busy,
  onUpload,
  onScreenshot,
  onRemove
}: AIImageInputBarProps): JSX.Element {
  const atLimit = images.length >= MAX_CHAT_IMAGES

  return (
    <div className="ai-image-input-bar">
      <div className="ai-image-input-actions">
        <IconButton
          icon={busy ? Loader2 : ImagePlus}
          label={atLimit ? `最多 ${MAX_CHAT_IMAGES} 张图片` : '上传图片'}
          size={16}
          className={`ai-image-action-btn${busy ? ' spinning' : ''}`}
          disabled={disabled || busy || atLimit}
          onClick={onUpload}
        />
        <IconButton
          icon={busy ? Loader2 : Scissors}
          label={atLimit ? `最多 ${MAX_CHAT_IMAGES} 张图片` : '截图'}
          size={16}
          className={`ai-image-action-btn${busy ? ' spinning' : ''}`}
          disabled={disabled || busy || atLimit}
          onClick={onScreenshot}
        />
        <span className="ai-image-input-hint">上传或截取本窗口画面，可与文字一并发送（需模型支持识图）</span>
      </div>
      {images.length > 0 && (
        <div className="ai-image-preview-list">
          {images.map((img) => (
            <div key={img.id} className="ai-image-preview-item">
              <img src={img.dataUrl} alt={img.name ?? '待发送图片'} />
              <button
                type="button"
                className="ai-image-preview-remove"
                aria-label="移除图片"
                disabled={disabled || busy}
                onClick={() => onRemove(img.id)}
              >
                <X size={12} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
