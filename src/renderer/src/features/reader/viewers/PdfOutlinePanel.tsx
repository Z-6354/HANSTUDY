import { ListTree } from 'lucide-react'
import type { PdfOutlineItem } from './pdfOutline'

interface PdfOutlinePanelProps {
  items: PdfOutlineItem[]
  loading: boolean
  currentPage: number
  onNavigate: (page: number) => void
}

function OutlineNode({
  item,
  currentPage,
  onNavigate
}: {
  item: PdfOutlineItem
  currentPage: number
  onNavigate: (page: number) => void
}): JSX.Element {
  const active = item.page != null && item.page === currentPage
  const canJump = item.page != null

  return (
    <>
      <button
        type="button"
        className={`pdf-outline-item${active ? ' active' : ''}`}
        style={{ paddingLeft: `${12 + item.level * 14}px` }}
        disabled={!canJump}
        onClick={(e) => {
          e.stopPropagation()
          if (item.page != null) onNavigate(item.page)
        }}
      >
        <span className="pdf-outline-title" title={item.title}>
          {item.title}
        </span>
        {item.page != null && <span className="pdf-outline-page">{item.page}</span>}
      </button>
      {item.children.map((child, idx) => (
        <OutlineNode key={`${child.title}-${child.page}-${idx}`} item={child} currentPage={currentPage} onNavigate={onNavigate} />
      ))}
    </>
  )
}

export function PdfOutlinePanel({
  items,
  loading,
  currentPage,
  onNavigate
}: PdfOutlinePanelProps): JSX.Element {
  return (
    <div className="pdf-side-panel-inner">
      <div className="pdf-side-panel-header">
        <ListTree size={14} aria-hidden />
        <span>目录</span>
      </div>
      <div className="pdf-side-panel-body pdf-outline-body">
        {loading && <p className="pdf-side-panel-hint">正在解析目录…</p>}
        {!loading && items.length === 0 && (
          <p className="pdf-side-panel-hint">该 PDF 无内置目录</p>
        )}
        {!loading &&
          items.map((item, idx) => (
            <OutlineNode key={`${item.title}-${item.page}-${idx}`} item={item} currentPage={currentPage} onNavigate={onNavigate} />
          ))}
      </div>
    </div>
  )
}
