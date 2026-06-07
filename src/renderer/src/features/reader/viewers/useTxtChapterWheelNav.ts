import { useEffect, useRef, type RefObject } from 'react'

const EDGE_PX = 4
const WHEEL_LOCK_MS = 380

export type ChapterScrollAnchor = 'top' | 'bottom'

interface UseTxtChapterWheelNavOptions {
  hostRef: RefObject<HTMLElement | null>
  enabled: boolean
  currentChapter: number
  chapterCount: number
  onChapterChange: (index: number, anchor: ChapterScrollAnchor) => void
}

/** 滚轮/触控板：章节顶/底继续滑动时切换上一章/下一章 */
export function useTxtChapterWheelNav({
  hostRef,
  enabled,
  currentChapter,
  chapterCount,
  onChapterChange
}: UseTxtChapterWheelNavOptions): void {
  const lockUntilRef = useRef(0)
  const chapterRef = useRef(currentChapter)
  chapterRef.current = currentChapter

  useEffect(() => {
    const el = hostRef.current
    if (!el || !enabled || chapterCount <= 1) return

    const trySwitch = (direction: 'up' | 'down', e: WheelEvent): boolean => {
      if (Date.now() < lockUntilRef.current) return false

      const { scrollTop, scrollHeight, clientHeight } = el
      const canScroll = scrollHeight > clientHeight + EDGE_PX
      const atTop = scrollTop <= EDGE_PX
      const atBottom = scrollTop + clientHeight >= scrollHeight - EDGE_PX
      const idx = chapterRef.current

      if (direction === 'down') {
        if (idx >= chapterCount - 1) return false
        if (canScroll && !atBottom) return false
        e.preventDefault()
        lockUntilRef.current = Date.now() + WHEEL_LOCK_MS
        onChapterChange(idx + 1, 'top')
        return true
      }

      if (idx <= 0) return false
      if (canScroll && !atTop) return false
      e.preventDefault()
      lockUntilRef.current = Date.now() + WHEEL_LOCK_MS
      onChapterChange(idx - 1, 'bottom')
      return true
    }

    const onWheel = (e: WheelEvent): void => {
      if (e.ctrlKey) return
      if (e.deltaY > 0) trySwitch('down', e)
      else if (e.deltaY < 0) trySwitch('up', e)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [hostRef, enabled, chapterCount, onChapterChange])
}
