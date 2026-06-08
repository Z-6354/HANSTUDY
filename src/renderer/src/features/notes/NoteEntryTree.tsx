import type { DocumentNoteEntry, NoteSortMode } from '@shared/documentNotes'
import { getNotebookChildren } from './documentNoteTree'
import { NoteComposer } from './NoteComposer'
import { NoteEntryCard } from './NoteEntryCard'
import type { useNoteTreeDrag } from './useNoteTreeDrag'

type NoteTreeDrag = ReturnType<typeof useNoteTreeDrag>

interface NoteEntryTreeProps {
  entries: DocumentNoteEntry[]
  parentId: string | null
  sortMode: NoteSortMode
  draggable: boolean
  treeDrag: NoteTreeDrag
  inlineInsertAfterId: string | null
  depth: number
  onNavigate: (entry: DocumentNoteEntry) => void
  onSave: (entryId: string, bodyMarkdown: string) => void
  onDeleteRequest: (entryId: string) => void
  onToggleCollapse: (entryId: string) => void
  onInsertBelow: (id: string) => void
  onInsertSubmit: (parentId: string, markdown: string) => void
  onInsertCancel: () => void
  notebookId?: string
}

export function NoteEntryTree({
  entries,
  parentId,
  sortMode,
  draggable,
  treeDrag,
  inlineInsertAfterId,
  depth,
  onNavigate,
  onSave,
  onDeleteRequest,
  onToggleCollapse,
  onInsertBelow,
  onInsertSubmit,
  onInsertCancel,
  notebookId
}: NoteEntryTreeProps): JSX.Element {
  const siblings = getNotebookChildren(entries, parentId, sortMode)

  return (
    <>
      {siblings.map((entry) => {
        const childEntries = getNotebookChildren(entries, entry.id, sortMode)
        const hasChildren = childEntries.length > 0
        const insertChildOpen = inlineInsertAfterId === entry.id
        const collapsed = entry.collapsed ?? false
        const showExpanded = !collapsed || insertChildOpen

        const showTail = draggable && treeDrag.draggingId != null && !treeDrag.isDragging(entry.id)

        return (
          <div key={entry.id} className="doc-note-entry-block">
            <NoteEntryCard
              entry={entry}
              hasChildren={hasChildren}
              forceExpanded={insertChildOpen}
              draggable={draggable}
              dragging={treeDrag.isDragging(entry.id)}
              dropIntent={treeDrag.getDropIntent(entry.id)}
              onNavigate={onNavigate}
              onSave={onSave}
              onDeleteRequest={onDeleteRequest}
              onToggleCollapse={onToggleCollapse}
              onDragPointerDown={(id, e) => treeDrag.begin(id, e.clientX, e.clientY, e.pointerId)}
              insertBelowOpen={insertChildOpen}
              onInsertBelow={() => onInsertBelow(entry.id)}
              notebookId={notebookId}
            />
            {showExpanded && (hasChildren || insertChildOpen) && (
              <div className="doc-note-entry-children">
                {hasChildren && (
                  <NoteEntryTree
                    entries={entries}
                    parentId={entry.id}
                    sortMode={sortMode}
                    draggable={draggable}
                    treeDrag={treeDrag}
                    inlineInsertAfterId={inlineInsertAfterId}
                    depth={depth + 1}
                    onNavigate={onNavigate}
                    onSave={onSave}
                    onDeleteRequest={onDeleteRequest}
                    onToggleCollapse={onToggleCollapse}
                    onInsertBelow={onInsertBelow}
                    onInsertSubmit={onInsertSubmit}
                    onInsertCancel={onInsertCancel}
                    notebookId={notebookId}
                  />
                )}
                {insertChildOpen && (
                  <NoteComposer
                    variant="inline"
                    submitLabel="添加子笔记"
                    placeholder="输入子笔记内容…"
                    onCancel={onInsertCancel}
                    onSubmit={(md) => onInsertSubmit(entry.id, md)}
                  />
                )}
              </div>
            )}
            {showTail && (
              <div
                className={`doc-note-entry-drop-tail${treeDrag.isDropTailActive(entry.id) ? ' doc-note-entry-drop-tail--active' : ''}`}
                data-note-drop-after={entry.id}
                aria-hidden
              />
            )}
          </div>
        )
      })}
    </>
  )
}
