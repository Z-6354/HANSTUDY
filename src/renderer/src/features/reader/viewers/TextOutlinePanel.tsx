import { ListTree } from 'lucide-react'
import type { TextOutlineItem } from './textOutline'

interface TextOutlinePanelProps {
  items: TextOutlineItem[]
  currentLine: number
  currentChapter?: number
  onNavigate: (line: number) => void
  onNavigateChapter?: (chapterIndex: number) => void
  showLineNumbers?: boolean
}

export function TextOutlinePanel({
  items,
  currentLine,
  currentChapter,
  onNavigate,
  onNavigateChapter,
  showLineNumbers = true
}: TextOutlinePanelProps): JSX.Element {
  return (
    <div className="pdf-side-panel-inner">
      <div className="pdf-side-panel-header">
        <ListTree size={14} aria-hidden />
        <span>目录</span>
      </div>
      <div className="pdf-side-panel-body pdf-outline-body">
        {items.length === 0 && (
          <p className="pdf-side-panel-hint">未识别到章节标题</p>
        )}
        {items.map((item, idx) => {
          const active =
            onNavigateChapter != null && currentChapter != null
              ? idx === currentChapter
              : item.line === currentLine
          return (
            <button
              key={`${item.line}-${idx}`}
              type="button"
              className={`pdf-outline-item${active ? ' active' : ''}`}
              style={{ paddingLeft: `${12 + item.level * 14}px` }}
              onClick={(e) => {
                e.stopPropagation()
                if (onNavigateChapter) {
                  onNavigateChapter(idx)
                } else {
                  onNavigate(item.line)
                }
              }}
            >
              <span className="pdf-outline-title" title={item.title}>
                {item.title}
              </span>
              {showLineNumbers && (
                <span className="pdf-outline-page">{item.line}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
