import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentNoteEntry } from '@shared/documentNotes'
import type { NoteDropIntent } from './NoteEntryCard'
import { applyNoteTreeDrop, descendantIds, isAncestorOf } from './documentNoteTree'

const DRAG_THRESHOLD_PX = 8
const INTENT_HYSTERESIS_PX = 14
const NOTE_ENTRY_SELECTOR = '[data-note-entry-id]'
const DROP_AFTER_SELECTOR = '[data-note-drop-after]'
const ZONE_BEFORE = 0.3
const ZONE_AFTER = 0.7

export interface NoteTreeDragHover {
  id: string
  intent: NoteDropIntent
  /** 命中尾部落点时为 true，避免卡片与尾部同时显示 after 蓝线 */
  viaTail?: boolean
}

interface IntentState {
  targetId: string
  intent: NoteDropIntent
  clientY: number
}

function intentFromRect(
  clientY: number,
  rect: DOMRect,
  prev: IntentState | null,
  targetId: string,
  draggedId: string,
  entries: DocumentNoteEntry[]
): NoteDropIntent {
  const height = Math.max(rect.height, 1)
  const y = clientY - rect.top
  const topEdge = height * ZONE_BEFORE
  const bottomEdge = height * ZONE_AFTER

  let intent: NoteDropIntent
  if (prev?.targetId === targetId) {
    const py = prev.clientY - rect.top
    if (prev.intent === 'before' && y < topEdge + INTENT_HYSTERESIS_PX && py < topEdge + INTENT_HYSTERESIS_PX) {
      intent = 'before'
    } else if (
      prev.intent === 'after' &&
      y > bottomEdge - INTENT_HYSTERESIS_PX &&
      py > bottomEdge - INTENT_HYSTERESIS_PX
    ) {
      intent = 'after'
    } else if (
      prev.intent === 'nest' &&
      y >= topEdge - INTENT_HYSTERESIS_PX &&
      y <= bottomEdge + INTENT_HYSTERESIS_PX
    ) {
      intent = 'nest'
    } else if (y < topEdge) {
      intent = 'before'
    } else if (y > bottomEdge) {
      intent = 'after'
    } else {
      intent = 'nest'
    }
  } else if (y < topEdge) {
    intent = 'before'
  } else if (y > bottomEdge) {
    intent = 'after'
  } else {
    intent = 'nest'
  }

  // 拖到祖先节点上时禁止 nest（改为同级前/后 → 可移出到外层）
  if (isAncestorOf(entries, targetId, draggedId) && intent === 'nest') {
    intent = y < height / 2 ? 'before' : 'after'
  }

  return intent
}

function dropZoneRect(card: HTMLElement): DOMRect {
  const header = card.querySelector('.doc-note-entry-header')
  const body = card.querySelector('.doc-note-entry-body')
  if (header instanceof HTMLElement && body instanceof HTMLElement) {
    const top = header.getBoundingClientRect().top
    const bottom = body.getBoundingClientRect().bottom
    const left = Math.min(header.getBoundingClientRect().left, body.getBoundingClientRect().left)
    const right = Math.max(header.getBoundingClientRect().right, body.getBoundingClientRect().right)
    return new DOMRect(left, top, right - left, bottom - top)
  }
  return card.getBoundingClientRect()
}

function resolveDropTarget(
  clientX: number,
  clientY: number,
  draggingId: string,
  entries: DocumentNoteEntry[],
  prevIntent: IntentState | null
): NoteTreeDragHover | null {
  const blocked = descendantIds(entries, draggingId)
  blocked.add(draggingId)

  const elements = document.elementsFromPoint(clientX, clientY)

  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue
    const card = el.closest(NOTE_ENTRY_SELECTOR)
    if (!(card instanceof HTMLElement)) continue
    const id = card.dataset.noteEntryId
    if (!id || blocked.has(id)) continue

    const rect = dropZoneRect(card)
    const intent = intentFromRect(clientY, rect, prevIntent, id, draggingId, entries)
    return { id, intent, viaTail: false }
  }

  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue
    const afterTail = el.closest(DROP_AFTER_SELECTOR)
    if (afterTail instanceof HTMLElement) {
      const id = afterTail.getAttribute('data-note-drop-after')
      if (id && !blocked.has(id) && id !== draggingId) {
        return { id, intent: 'after', viaTail: true }
      }
    }
  }

  return null
}

export function useNoteTreeDrag(
  enabled: boolean,
  entries: DocumentNoteEntry[],
  onPersist: (nextEntries: DocumentNoteEntry[]) => void
) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hover, setHover] = useState<NoteTreeDragHover | null>(null)
  const sessionRef = useRef<{
    entryId: string
    startX: number
    startY: number
    pointerId: number
    active: boolean
  } | null>(null)
  const intentStateRef = useRef<IntentState | null>(null)
  const hoverRef = useRef<NoteTreeDragHover | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  hoverRef.current = hover

  const reset = useCallback((): void => {
    sessionRef.current = null
    intentStateRef.current = null
    setDraggingId(null)
    setHover(null)
  }, [])

  useEffect(() => {
    return () => cleanupRef.current?.()
  }, [])

  const begin = useCallback(
    (entryId: string, clientX: number, clientY: number, pointerId: number): void => {
      if (!enabled) return

      cleanupRef.current?.()
      reset()

      sessionRef.current = {
        entryId,
        startX: clientX,
        startY: clientY,
        pointerId,
        active: false
      }

      const onMove = (ev: PointerEvent): void => {
        const session = sessionRef.current
        if (!session || ev.pointerId !== session.pointerId) return

        const dx = ev.clientX - session.startX
        const dy = ev.clientY - session.startY

        if (!session.active) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
          session.active = true
          setDraggingId(session.entryId)
        }

        const target = resolveDropTarget(
          ev.clientX,
          ev.clientY,
          session.entryId,
          entriesRef.current,
          intentStateRef.current
        )

        if (target && target.id !== session.entryId) {
          intentStateRef.current = {
            targetId: target.id,
            intent: target.intent,
            clientY: ev.clientY
          }
          setHover(target)
        } else {
          intentStateRef.current = null
          setHover(null)
        }
      }

      const onUp = (ev: PointerEvent): void => {
        const session = sessionRef.current
        if (!session || ev.pointerId !== session.pointerId) return

        cleanupRef.current?.()
        cleanupRef.current = null

        if (session.active) {
          const target = hoverRef.current
          if (target && target.id !== session.entryId) {
            const next = applyNoteTreeDrop(
              entriesRef.current,
              session.entryId,
              target.id,
              target.intent
            )
            if (next !== entriesRef.current) {
              onPersist(next)
            }
          }
        }

        reset()
      }

      const cleanup = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }

      cleanupRef.current = cleanup
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [enabled, onPersist, reset]
  )

  useEffect(() => {
    if (!draggingId) return
    document.body.classList.add('doc-note-tree-dragging')
    return () => document.body.classList.remove('doc-note-tree-dragging')
  }, [draggingId])

  const getDropIntent = useCallback(
    (entryId: string): NoteDropIntent | null => {
      if (!draggingId || draggingId === entryId) return null
      if (hover?.id !== entryId) return null
      if (hover.viaTail) return null
      return hover.intent
    },
    [draggingId, hover]
  )

  const isDropTailActive = useCallback(
    (entryId: string): boolean => {
      return (
        draggingId != null &&
        draggingId !== entryId &&
        hover?.id === entryId &&
        hover.intent === 'after' &&
        hover.viaTail === true
      )
    },
    [draggingId, hover]
  )

  const isDropTarget = useCallback(
    (entryId: string): boolean => {
      return draggingId != null && draggingId !== entryId && hover?.id === entryId
    },
    [draggingId, hover]
  )

  return {
    draggingId,
    begin,
    getDropIntent,
    isDropTailActive,
    isDropTarget,
    isDragging: (entryId: string): boolean => draggingId === entryId
  }
}
