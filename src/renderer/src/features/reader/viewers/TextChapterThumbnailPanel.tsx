import { LayoutGrid } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { TxtChapter } from './textChapters'
import { getChapterThumbSnippet } from './txtChapterFormat'
import { useDragScroll } from './useDragScroll'

interface TextChapterThumbnailPanelProps {
  chapters: TxtChapter[]
  currentChapter: number
  open: boolean
  onNavigate: (chapterIndex: number) => void
}

function isVisible(root: HTMLElement, item: HTMLElement): boolean {
  const rootRect = root.getBoundingClientRect()
  const itemRect = item.getBoundingClientRect()
  const margin = 8
  return itemRect.top >= rootRect.top + margin && itemRect.bottom <= rootRect.bottom - margin
}

export function TextChapterThumbnailPanel({
  chapters,
  currentChapter,
  open,
  onNavigate
}: TextChapterThumbnailPanelProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useDragScroll()

  useEffect(() => {
    if (!open || !scrollRef.current || chapters.length === 0) return

    const scrollToCurrent = (): void => {
      const root = scrollRef.current
      const active = root?.querySelector<HTMLElement>('.txt-chapter-thumb-item.active')
      if (!root || !active) return
      if (!isVisible(root, active)) {
        active.scrollIntoView({ block: 'center', behavior: 'auto' })
      }
    }

    requestAnimationFrame(() => {
      scrollToCurrent()
      requestAnimationFrame(scrollToCurrent)
    })
  }, [open, currentChapter, chapters.length])

  return (
    <div className="pdf-side-panel-inner txt-chapter-thumb-panel">
      <div className="pdf-side-panel-header">
        <LayoutGrid size={14} aria-hidden />
        <span>章节</span>
        {chapters.length > 0 && (
          <span className="txt-chapter-thumb-count">
            {currentChapter + 1}/{chapters.length}
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        className="pdf-side-panel-body pdf-thumb-body txt-chapter-thumb-body"
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerCancel}
      >
        {chapters.length === 0 && (
          <p className="pdf-side-panel-hint">未识别到章节</p>
        )}
        {chapters.map((chapter, index) => {
          const active = index === currentChapter
          const snippet = getChapterThumbSnippet(chapter)
          return (
            <button
              key={chapter.id}
              type="button"
              className={`txt-chapter-thumb-item${active ? ' active' : ''}`}
              data-no-drag-scroll
              title={chapter.title}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                if (drag.wasDragging()) return
                onNavigate(index)
              }}
            >
              <span className="txt-chapter-thumb-badge">{index + 1}</span>
              <div className="txt-chapter-thumb-page">
                <span className="txt-chapter-thumb-title">{chapter.title}</span>
                <span className="txt-chapter-thumb-snippet">{snippet}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
