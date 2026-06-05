import { StickyNote, ZoomIn, ZoomOut } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import { useEffect, useRef, useState } from 'react'
import { IconButton } from '../components/IconButton'
import { useAnnotationSurface } from '../annotations/AnnotationSurfaceContext'
import { NoteInputModal } from '../annotations/SelectionToolbar'
import { useAnnotations } from '../annotations/useAnnotations'
import { useWorkspaceStore } from '../stores/workspaceStore'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfViewerProps {
  filePath: string
}

export function PdfViewer({ filePath }: PdfViewerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1.2)
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [noteMode, setNoteMode] = useState(false)
  const [pendingAnchor, setPendingAnchor] = useState<{
    page: number
    x: number
    y: number
  } | null>(null)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const [scrollSurface, setScrollSurface] = useState<HTMLDivElement | null>(null)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

  useAnnotationSurface(scrollSurface)

  const { annotations, create } = useAnnotations(filePath)
  const { focusAnnotationId, setFocusAnnotationId, annotationTool } = useWorkspaceStore()
  const pdfNotes = annotations.filter((a) => a.type === 'note' && a.pdfAnchor)

  useEffect(() => {
    setNoteMode(annotationTool === 'note')
  }, [annotationTool])

  useEffect(() => {
    setScrollSurface(containerRef.current)
  }, [loading, scale, pageCount])

  useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    if (!container) return

    setLoading(true)
    setError(null)
    container.innerHTML = ''

    const loadPdf = async (): Promise<void> => {
      try {
        const bytes = await window.api.fs.readBinary(filePath)
        const data = new Uint8Array(bytes)
        const pdf = await pdfjsLib.getDocument({ data }).promise
        if (cancelled) return

        pdfDocRef.current = pdf
        setPageCount(pdf.numPages)

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale })

          const pageWrap = document.createElement('div')
          pageWrap.className = 'pdf-page-wrap'
          pageWrap.dataset.page = String(i)
          pageWrap.style.position = 'relative'
          pageWrap.style.width = `${viewport.width}px`
          pageWrap.style.height = `${viewport.height}px`

          const canvas = document.createElement('canvas')
          canvas.className = 'pdf-page'
          canvas.dataset.page = String(i)
          const context = canvas.getContext('2d')
          if (!context) continue

          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvasContext: context, viewport }).promise

          pageWrap.appendChild(canvas)
          container.appendChild(pageWrap)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '无法加载 PDF 文件')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPdf()
    return () => {
      cancelled = true
      pdfDocRef.current = null
    }
  }, [filePath, scale])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = (): void => {
      const pages = container.querySelectorAll<HTMLElement>('.pdf-page-wrap')
      const containerTop = container.getBoundingClientRect().top
      for (const page of pages) {
        const rect = page.getBoundingClientRect()
        if (rect.top <= containerTop + 100 && rect.bottom > containerTop) {
          setCurrentPage(Number(page.dataset.page))
          break
        }
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [loading])

  useEffect(() => {
    const handleWheel = (e: WheelEvent): void => {
      if (e.ctrlKey) {
        e.preventDefault()
        setScale((s) => Math.min(3, Math.max(0.5, s + (e.deltaY > 0 ? -0.1 : 0.1))))
      }
    }
    const el = containerRef.current
    el?.addEventListener('wheel', handleWheel, { passive: false })
    return () => el?.removeEventListener('wheel', handleWheel)
  }, [])

  useEffect(() => {
    if (!focusAnnotationId) return
    const ann = annotations.find((a) => a.id === focusAnnotationId)
    if (!ann?.pdfAnchor) return
    setExpandedNoteId(ann.id)
    const container = containerRef.current
    const pageEl = container?.querySelector(`[data-page="${ann.pdfAnchor.page}"]`)
    pageEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFocusAnnotationId(null)
  }, [focusAnnotationId, annotations, setFocusAnnotationId])

  useEffect(() => {
    const container = containerRef.current
    if (!container || loading) return

    container.querySelectorAll('.pdf-pin').forEach((el) => el.remove())

    pdfNotes.forEach((note) => {
      if (!note.pdfAnchor) return
      const pageWrap = container.querySelector<HTMLElement>(
        `.pdf-page-wrap[data-page="${note.pdfAnchor.page}"]`
      )
      if (!pageWrap) return

      const pin = document.createElement('div')
      pin.className = `pdf-pin ${expandedNoteId === note.id ? 'open' : ''}`
      pin.style.left = `${note.pdfAnchor.x * 100}%`
      pin.style.top = `${note.pdfAnchor.y * 100}%`
      pin.textContent = '📌'
      pin.onclick = (e) => {
        e.stopPropagation()
        setExpandedNoteId((id) => (id === note.id ? null : note.id))
      }

      if (expandedNoteId === note.id) {
        const popup = document.createElement('div')
        popup.className = 'pdf-pin-popup'
        popup.innerHTML = `<p>${note.content || '（无内容）'}</p>`
        pin.appendChild(popup)
      }

      pageWrap.appendChild(pin)
    })
  }, [loading, pdfNotes, expandedNoteId, scale])

  const handlePageClick = (e: React.MouseEvent): void => {
    if (!noteMode) return
    const target = (e.target as HTMLElement).closest('.pdf-page-wrap') as HTMLElement | null
    if (!target) return
    const page = Number(target.dataset.page)
    const rect = target.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setPendingAnchor({ page, x, y })
  }

  const savePdfNote = async (content: string): Promise<void> => {
    if (!pendingAnchor) return
    await create({
      type: 'note',
      color: '#ffd500',
      content,
      pdfAnchor: pendingAnchor
    })
    setPendingAnchor(null)
    setNoteMode(false)
  }

  return (
    <div ref={wrapperRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="pdf-toolbar">
        <IconButton icon={ZoomOut} label="缩小" onClick={() => setScale((s) => Math.max(0.5, s - 0.1))} />
        <span>{Math.round(scale * 100)}%</span>
        <IconButton icon={ZoomIn} label="放大" onClick={() => setScale((s) => Math.min(3, s + 0.1))} />
        <span style={{ marginLeft: 16 }}>
          第 {currentPage} / {pageCount} 页
        </span>
        <IconButton
          icon={StickyNote}
          label={noteMode ? '点击页面添加便签' : '添加便签'}
          className={`pdf-note-btn ${noteMode ? 'active' : ''}`}
          active={noteMode}
          onClick={() => setNoteMode((v) => !v)}
        />
      </div>

      {loading && <div className="loading-state">加载 PDF...</div>}
      {error && <div className="error-state">{error}</div>}

      <div
        ref={containerRef}
        className={`pdf-viewer ${noteMode ? 'note-mode' : ''}`}
        style={{ display: loading || error ? 'none' : 'flex' }}
        onClick={handlePageClick}
      />

      {pendingAnchor && (
        <NoteInputModal
          onSubmit={savePdfNote}
          onCancel={() => {
            setPendingAnchor(null)
            setNoteMode(false)
          }}
        />
      )}
    </div>
  )
}
