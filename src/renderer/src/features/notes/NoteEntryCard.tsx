import {
  ChevronDown,
  ChevronRight,
  ListPlus,
  MapPin,
  Pencil,
  Sparkles,
  Trash2
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type { DocumentNoteEntry } from '@shared/documentNotes'
import { IconButton } from '../../components/IconButton'
import { formatNoteAnchorLabel, formatNoteDocLabel } from './documentNoteSort'
import { isAiNoteAnchor } from '@shared/aiNoteMarkdown'
import { renderNoteMarkdownHtml } from './noteMarkdown'
import { useWorkspaceStore } from '../../stores/workspaceStore'

export type NoteDropIntent = 'nest' | 'before' | 'after'

interface NoteEntryCardProps {
  entry: DocumentNoteEntry
  hasChildren?: boolean
  draggable?: boolean
  dragging?: boolean
  dropIntent?: NoteDropIntent | null
  onNavigate: (entry: DocumentNoteEntry) => void
  onSave: (entryId: string, bodyMarkdown: string) => void
  onDeleteRequest: (entryId: string) => void
  onToggleCollapse: (entryId: string) => void
  onDragPointerDown?: (entryId: string, e: ReactPointerEvent<HTMLElement>) => void
  onInsertBelow: () => void
  insertBelowOpen?: boolean
  forceExpanded?: boolean
  notebookId?: string
}

function isDragExcludedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true
  return Boolean(
    target.closest(
      'button, textarea, input, a, [contenteditable], .doc-note-composer, .doc-note-entry-textarea, .doc-note-entry-drag-pad'
    )
  )
}

function isHeaderToggleExcluded(target: EventTarget | null): boolean {
  return isDragExcludedTarget(target)
}

export function NoteEntryCard({
  entry,
  hasChildren = false,
  draggable = false,
  dragging = false,
  dropIntent = null,
  onNavigate,
  onSave,
  onDeleteRequest,
  onToggleCollapse,
  onDragPointerDown,
  onInsertBelow,
  insertBelowOpen = false,
  forceExpanded = false,
  notebookId
}: NoteEntryCardProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.bodyMarkdown)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const collapsed = forceExpanded ? false : (entry.collapsed ?? false)
  const { addChatContextItem, openAIPanel } = useWorkspaceStore()

  const previewHtml = useMemo(
    () => renderNoteMarkdownHtml(entry.bodyMarkdown),
    [entry.bodyMarkdown]
  )

  const handleSave = useCallback((): void => {
    onSave(entry.id, draft)
    setEditing(false)
  }, [draft, entry.id, onSave])

  const handleCancel = useCallback((): void => {
    setDraft(entry.bodyMarkdown)
    setEditing(false)
  }, [entry.bodyMarkdown])

  useEffect(() => {
    if (!contextMenu) return
    const close = (): void => setContextMenu(null)
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [contextMenu])

  const handleDragPointerDown = (e: ReactPointerEvent<HTMLElement>): void => {
    if (!draggable || editing || e.button !== 0) return
    if (isDragExcludedTarget(e.target)) return
    onDragPointerDown?.(entry.id, e)
  }

  const handleHeaderClick = (e: MouseEvent<HTMLElement>): void => {
    if (editing || forceExpanded) return
    if (isHeaderToggleExcluded(e.target)) return
    onToggleCollapse(entry.id)
  }

  const handleAddToChat = (): void => {
    const content =
      entry.bodyMarkdown.trim() ||
      entry.anchor.quoteText?.trim() ||
      '（空笔记）'
    addChatContextItem({
      kind: 'note',
      label: formatNoteDocLabel(entry),
      content,
      hint: formatNoteAnchorLabel(entry),
      noteEntryId: entry.id,
      anchor: entry.anchor,
      notebookId
    })
    openAIPanel()
    setContextMenu(null)
  }

  const handleContextMenu = (e: MouseEvent): void => {
    if (editing) return
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const isAiNote = isAiNoteAnchor(entry.anchor.docPath, entry.anchor.aiSessionId)
  const navigateTitle = isAiNote ? '跳转到 AI 对话历史' : entry.anchor.docPath

  return (
    <>
      <article
        data-note-entry-id={entry.id}
        className={`doc-note-entry${collapsed ? ' doc-note-entry--collapsed' : ''}${draggable ? ' doc-note-entry--manual-drag' : ''}${dragging ? ' doc-note-entry--dragging' : ''}${dropIntent ? ` doc-note-entry--drop-${dropIntent}` : ''}`}
        title={draggable ? '按住拖动以调整位置或层级' : undefined}
        onPointerDown={handleDragPointerDown}
        onContextMenu={handleContextMenu}
      >
        <header className="doc-note-entry-header" onClick={handleHeaderClick}>
          <button
            type="button"
            className="doc-note-entry-collapse"
            aria-expanded={!collapsed}
            onClick={() => onToggleCollapse(entry.id)}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="button"
            className="doc-note-entry-doc"
            title={navigateTitle}
            onClick={() => onNavigate(entry)}
          >
            {formatNoteDocLabel(entry)}
          </button>
          <button
            type="button"
            className="doc-note-entry-anchor"
            title={isAiNote ? '跳转到 AI 对话历史' : '跳转到对应文档位置'}
            onClick={() => onNavigate(entry)}
          >
            <MapPin size={12} />
            {formatNoteAnchorLabel(entry)}
          </button>
          <time className="doc-note-entry-time" dateTime={entry.createdAt}>
            {new Date(entry.createdAt).toLocaleString()}
          </time>
          {draggable && !editing && <span className="doc-note-entry-drag-pad" aria-hidden />}
          {!editing && (
            <>
              <IconButton
                icon={Sparkles}
                label="添加到 AI 对话"
                size={14}
                className="doc-note-entry-ai"
                onClick={handleAddToChat}
              />
              <IconButton
                icon={ListPlus}
                label="插入子笔记"
                size={14}
                className={`doc-note-entry-insert${insertBelowOpen ? ' active' : ''}`}
                onClick={onInsertBelow}
              />
              <IconButton
                icon={Pencil}
                label="编辑"
                size={14}
                className="doc-note-entry-edit"
                onClick={() => {
                  setDraft(entry.bodyMarkdown)
                  setEditing(true)
                }}
              />
            </>
          )}
        </header>

        {!collapsed && (
          <div className="doc-note-entry-body">
            {entry.anchor.quoteText && (
              <blockquote className="doc-note-entry-quote">{entry.anchor.quoteText}</blockquote>
            )}
            {editing ? (
              <div className="doc-note-entry-edit-area">
                <textarea
                  className="doc-note-entry-textarea"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={6}
                />
                <div className="doc-note-entry-edit-actions">
                  <button type="button" className="btn-secondary" onClick={handleCancel}>
                    取消
                  </button>
                  <button type="button" className="btn-primary" onClick={handleSave}>
                    保存
                  </button>
                </div>
              </div>
            ) : (
              entry.bodyMarkdown.trim() && (
                <div
                  className="doc-note-entry-preview markdown-body"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              )
            )}
            {dropIntent === 'nest' && (
              <div className="doc-note-entry-nest-hint">松手以嵌套到此笔记内</div>
            )}
          </div>
        )}
      </article>

      {contextMenu && (
        <div
          className="context-menu note-entry-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              handleAddToChat()
            }}
          >
            <Sparkles size={14} />
            添加到 AI 对话
          </button>
          <button
            type="button"
            className="danger"
            onMouseDown={(e) => {
              e.preventDefault()
              setContextMenu(null)
              onDeleteRequest(entry.id)
            }}
          >
            <Trash2 size={14} />
            删除笔记
            {hasChildren && <span className="note-ctx-badge">含子笔记</span>}
          </button>
        </div>
      )}
    </>
  )
}
