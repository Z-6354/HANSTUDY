import { LayoutGrid } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import { useCallback, useEffect, useRef, useState } from 'react'
import { renderPdfThumbnail } from './pdfThumbnails'
import { useDragScroll } from './useDragScroll'

interface PdfThumbnailPanelProps {
  pdf: pdfjsLib.PDFDocumentProxy | null
  pageCount: number
  currentPage: number
  open: boolean
  onNavigate: (page: number) => void
}

function isThumbVisible(root: HTMLElement, item: HTMLElement): boolean {
  const rootRect = root.getBoundingClientRect()
  const itemRect = item.getBoundingClientRect()
  const margin = 8
  return itemRect.top >= rootRect.top + margin && itemRect.bottom <= rootRect.bottom - margin
}

export function PdfThumbnailPanel({
  pdf,
  pageCount,
  currentPage,
  open,
  onNavigate
}: PdfThumbnailPanelProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasMapRef = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const renderPageRef = useRef<(pageNo: number) => Promise<void>>(async () => {})
  const [renderTick, setRenderTick] = useState(0)
  const drag = useDragScroll()

  const mountThumb = useCallback((pageNo: number, host: HTMLElement): void => {
    const existing = canvasMapRef.current.get(pageNo)
    if (existing) {
      if (!host.contains(existing)) {
        host.replaceChildren(existing)
      }
      return
    }
    host.classList.add('pdf-thumb-loading')
  }, [])

  useEffect(() => {
    if (!pdf || pageCount <= 0 || !scrollRef.current) return

    let cancelled = false
    const pending = new Set<number>()

    const renderPage = async (pageNo: number): Promise<void> => {
      if (cancelled || pending.has(pageNo) || canvasMapRef.current.has(pageNo)) return
      pending.add(pageNo)
      const host = scrollRef.current?.querySelector<HTMLElement>(
        `.pdf-thumb-slot[data-page="${pageNo}"]`
      )
      if (!host) {
        pending.delete(pageNo)
        return
      }

      const signal = { cancelled: () => cancelled }
      const canvas = await renderPdfThumbnail(pdf, pageNo, signal)
      pending.delete(pageNo)
      if (!canvas || cancelled) return

      canvasMapRef.current.set(pageNo, canvas)
      host.classList.remove('pdf-thumb-loading')
      host.replaceChildren(canvas)
      setRenderTick((n) => n + 1)
    }

    renderPageRef.current = renderPage

    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const pageNo = Number((entry.target as HTMLElement).dataset.page)
          if (pageNo > 0) void renderPage(pageNo)
        }
      },
      { root: scrollRef.current, rootMargin: '120px 0px' }
    )

    const slots = scrollRef.current.querySelectorAll<HTMLElement>('.pdf-thumb-slot')
    slots.forEach((slot) => observerRef.current?.observe(slot))

    return () => {
      cancelled = true
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [pdf, pageCount, renderTick])

  useEffect(() => {
    return () => {
      canvasMapRef.current.clear()
    }
  }, [pdf, pageCount])

  /** 面板打开或当前页变化：直接定位到当前页，避免从第 1 页 smooth 滑下来 */
  useEffect(() => {
    if (!open || !scrollRef.current || pageCount <= 0) return

    const scrollToCurrent = (): void => {
      const root = scrollRef.current
      const active = root?.querySelector<HTMLElement>('.pdf-thumb-item.active')
      if (!root || !active) return
      if (!isThumbVisible(root, active)) {
        active.scrollIntoView({ block: 'center', behavior: 'auto' })
      }
    }

    const eagerAround = (): void => {
      const from = Math.max(1, currentPage - 2)
      const to = Math.min(pageCount, currentPage + 2)
      for (let p = from; p <= to; p++) {
        void renderPageRef.current(p)
      }
    }

    eagerAround()
    requestAnimationFrame(() => {
      scrollToCurrent()
      requestAnimationFrame(scrollToCurrent)
    })
  }, [open, currentPage, pageCount])

  return (
    <div className="pdf-side-panel-inner">
      <div className="pdf-side-panel-header">
        <LayoutGrid size={14} aria-hidden />
        <span>缩略图</span>
      </div>
      <div
        ref={scrollRef}
        className="pdf-side-panel-body pdf-thumb-body"
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerCancel}
      >
        {Array.from({ length: pageCount }, (_, i) => {
          const pageNo = i + 1
          const active = pageNo === currentPage
          return (
            <button
              key={pageNo}
              type="button"
              className={`pdf-thumb-item${active ? ' active' : ''}`}
              data-no-drag-scroll
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                if (drag.wasDragging()) return
                onNavigate(pageNo)
              }}
            >
              <div
                className="pdf-thumb-slot"
                data-page={pageNo}
                ref={(el) => {
                  if (el) mountThumb(pageNo, el)
                }}
              />
              <span className="pdf-thumb-label">{pageNo}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
