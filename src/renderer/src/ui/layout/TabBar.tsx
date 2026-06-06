import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { IconButton } from '../../components/IconButton'
import type { OpenDocument } from '../../stores/workspaceStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { TabDocIcon } from '../../utils/fileIcons'

interface TabContextMenu {
  x: number
  y: number
  docId: string
}

interface TabBarProps {
  onOpenFile: () => void
}

export function TabBar({ onOpenFile }: TabBarProps): JSX.Element | null {
  const {
    documents,
    activeDocumentId,
    setActiveDocument,
    closeDocument,
    closeOtherDocuments,
    closeAllDocuments,
    reorderDocuments
  } = useWorkspaceStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<TabContextMenu | null>(null)
  const [dragTabId, setDragTabId] = useState<string | null>(null)

  useEffect(() => {
    const closeMenu = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      if (target.closest('.tab-context-menu')) return
      setContextMenu(null)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !activeDocumentId) return
    const activeTab = el.querySelector(`[data-tab-id="${activeDocumentId}"]`)
    activeTab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeDocumentId, documents.length])

  const handleWheel = (e: React.WheelEvent): void => {
    if (!scrollRef.current) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scrollRef.current.scrollLeft += e.deltaY
    }
  }

  const handleTabContextMenu = (e: React.MouseEvent, doc: OpenDocument): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, docId: doc.id })
  }

  if (documents.length === 0) return null

  return (
    <>
      <div className="tab-bar" onWheel={handleWheel}>
        <div className="tab-bar-scroll" ref={scrollRef}>
          {documents.map((doc) => (
            <div
              key={doc.id}
              data-tab-id={doc.id}
              className={`tab ${doc.id === activeDocumentId ? 'active' : ''} ${dragTabId === doc.id ? 'dragging' : ''}`}
              draggable
              onClick={() => setActiveDocument(doc.id)}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault()
                  closeDocument(doc.id)
                }
              }}
              onContextMenu={(e) => handleTabContextMenu(e, doc)}
              onDragStart={() => setDragTabId(doc.id)}
              onDragEnd={() => setDragTabId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (dragTabId && dragTabId !== doc.id) {
                  reorderDocuments(dragTabId, doc.id)
                }
                setDragTabId(null)
              }}
            >
              <span className="tab-icon">
                <TabDocIcon type={doc.type} name={doc.name} />
              </span>
              <span className="tab-name" title={doc.path}>
                {doc.name}
              </span>
              <IconButton
                icon={X}
                label="关闭"
                size={14}
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  closeDocument(doc.id)
                }}
              />
            </div>
          ))}
        </div>
        <IconButton icon={Plus} label="打开文件" className="tab-bar-action" onClick={onOpenFile} />
      </div>

      {contextMenu && (
        <div
          className="context-menu tab-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              closeDocument(contextMenu.docId)
              setContextMenu(null)
            }}
          >
            关闭
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              closeOtherDocuments(contextMenu.docId)
              setContextMenu(null)
            }}
          >
            关闭其他
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              closeAllDocuments()
              setContextMenu(null)
            }}
          >
            全部关闭
          </button>
        </div>
      )}
    </>
  )
}
