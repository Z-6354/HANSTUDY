import type { DocumentNoteEntry, NoteSortMode } from '@shared/documentNotes'
import { anchorSortKey, sortDocumentNoteEntries } from './documentNoteSort'

export function getParentId(entry: DocumentNoteEntry): string | null {
  return entry.parentId ?? null
}

export function entriesForDoc(
  entries: DocumentNoteEntry[],
  docPath: string
): DocumentNoteEntry[] {
  return entries.filter((e) => e.anchor.docPath === docPath)
}

/** 将旧版 depth 字段迁移为 parentId 树 */
export function migrateDepthToParentId(
  entries: DocumentNoteEntry[],
  docPath: string
): DocumentNoteEntry[] {
  const docEntries = sortDocumentNoteEntries(entriesForDoc(entries, docPath), 'manual')
  const others = entries.filter((e) => e.anchor.docPath !== docPath)
  const hasParent = docEntries.some((e) => e.parentId)
  if (hasParent) return entries

  const stack: Array<{ id: string; depth: number }> = []
  const migrated = docEntries.map((entry) => {
    const depth = entry.depth ?? 0
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= depth) {
      stack.pop()
    }
    const parentId = stack.length > 0 ? stack[stack.length - 1]!.id : null
    stack.push({ id: entry.id, depth })
    const { depth: _d, ...rest } = entry
    return { ...rest, parentId: parentId ?? undefined }
  })
  return [...others, ...migrated]
}

export function entryDepth(entries: DocumentNoteEntry[], entryId: string): number {
  const map = new Map(entries.map((e) => [e.id, e]))
  let depth = 0
  let current = map.get(entryId)
  const seen = new Set<string>()
  while (current?.parentId) {
    if (seen.has(current.parentId)) break
    seen.add(current.parentId)
    depth++
    current = map.get(current.parentId)
  }
  return depth
}

export function descendantIds(entries: DocumentNoteEntry[], entryId: string): Set<string> {
  const result = new Set<string>()
  const walk = (id: string): void => {
    for (const e of entries) {
      if (getParentId(e) === id && !result.has(e.id)) {
        result.add(e.id)
        walk(e.id)
      }
    }
  }
  walk(entryId)
  return result
}

export function wouldCreateCycle(
  entries: DocumentNoteEntry[],
  childId: string,
  newParentId: string | null
): boolean {
  if (childId === newParentId) return true
  if (!newParentId) return false
  return descendantIds(entries, childId).has(newParentId)
}

export function isAncestorOf(
  entries: DocumentNoteEntry[],
  ancestorId: string,
  nodeId: string
): boolean {
  let current = entries.find((e) => e.id === nodeId)
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true
    current = entries.find((e) => e.id === current!.parentId)
  }
  return false
}

/** pointer 拖放落点 → 树操作（含祖先落点禁止 nest、防环；支持跨文档） */
export function applyNoteTreeDrop(
  allEntries: DocumentNoteEntry[],
  fromId: string,
  toId: string,
  intent: 'nest' | 'before' | 'after'
): DocumentNoteEntry[] {
  if (fromId === toId) return allEntries
  if (descendantIds(allEntries, fromId).has(toId)) return allEntries

  const from = allEntries.find((e) => e.id === fromId)
  const to = allEntries.find((e) => e.id === toId)
  if (!from || !to) return allEntries

  if (intent === 'nest') {
    if (isAncestorOf(allEntries, toId, fromId)) return allEntries
    if (getParentId(from) === toId) return allEntries
    return nestEntryUnder(allEntries, fromId, toId)
  }
  if (intent === 'before') {
    return moveEntryBeforeSibling(allEntries, fromId, toId)
  }
  return moveEntryAfterSibling(allEntries, fromId, toId)
}

export function getChildren(
  entries: DocumentNoteEntry[],
  docPath: string,
  parentId: string | null,
  sortMode: NoteSortMode
): DocumentNoteEntry[] {
  const siblings = entriesForDoc(entries, docPath).filter(
    (e) => getParentId(e) === parentId
  )
  return sortDocumentNoteEntries(siblings, sortMode)
}

/** 笔记本全量视图：根级跨文档，子级按 parentId（可跨文档） */
export function getNotebookChildren(
  entries: DocumentNoteEntry[],
  parentId: string | null,
  sortMode: NoteSortMode
): DocumentNoteEntry[] {
  if (parentId !== null) {
    const siblings = entries.filter((e) => getParentId(e) === parentId)
    return sortDocumentNoteEntries(siblings, sortMode)
  }

  const roots = entries.filter((e) => getParentId(e) === null)
  if (sortMode === 'document') {
    return [...roots].sort((a, b) => {
      const pathCmp = a.anchor.docPath.localeCompare(b.anchor.docPath)
      if (pathCmp !== 0) return pathCmp
      const diff = anchorSortKey(a) - anchorSortKey(b)
      if (diff !== 0) return diff
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }
  return sortDocumentNoteEntries(roots, sortMode)
}

export function nextSortIndexForParent(
  entries: DocumentNoteEntry[],
  parentId: string | null
): number {
  const siblings = entries.filter((e) => getParentId(e) === parentId)
  if (siblings.length === 0) return 0
  return Math.max(...siblings.map((e) => e.sortIndex ?? 0)) + 1
}

export function nextSortIndex(
  entries: DocumentNoteEntry[],
  docPath: string,
  parentId: string | null
): number {
  const siblings = getChildren(entries, docPath, parentId, 'manual')
  if (siblings.length === 0) return 0
  return Math.max(...siblings.map((e) => e.sortIndex ?? 0)) + 1
}

function renormalizeSiblingsByParent(
  allEntries: DocumentNoteEntry[],
  parentId: string | null
): DocumentNoteEntry[] {
  const siblings = sortDocumentNoteEntries(
    allEntries.filter((e) => getParentId(e) === parentId),
    'manual'
  )
  const order = new Map(siblings.map((e, i) => [e.id, i]))
  return allEntries.map((e) => {
    if (getParentId(e) !== parentId) return e
    const idx = order.get(e.id)
    return idx == null ? e : { ...e, sortIndex: idx }
  })
}

function updateEntry(
  entries: DocumentNoteEntry[],
  entryId: string,
  patch: Partial<DocumentNoteEntry>
): DocumentNoteEntry[] {
  return entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e))
}

/** 拖入某条笔记内，成为其子笔记（可跨文档） */
export function nestEntryUnder(
  allEntries: DocumentNoteEntry[],
  childId: string,
  parentId: string
): DocumentNoteEntry[] {
  if (wouldCreateCycle(allEntries, childId, parentId)) return allEntries
  const parent = allEntries.find((e) => e.id === parentId)
  const child = allEntries.find((e) => e.id === childId)
  if (!parent || !child) return allEntries

  const oldParentId = getParentId(child)
  let next = updateEntry(allEntries, childId, {
    parentId,
    sortIndex: nextSortIndexForParent(allEntries, parentId)
  })
  next = renormalizeSiblingsByParent(next, oldParentId)
  return renormalizeSiblingsByParent(next, parentId)
}

/** 移到目标笔记之前（同级，可跨文档） */
export function moveEntryBeforeSibling(
  allEntries: DocumentNoteEntry[],
  movedId: string,
  targetId: string
): DocumentNoteEntry[] {
  const target = allEntries.find((e) => e.id === targetId)
  const moved = allEntries.find((e) => e.id === movedId)
  if (!target || !moved) return allEntries
  if (wouldCreateCycle(allEntries, movedId, getParentId(target))) return allEntries

  const parentId = getParentId(target)
  const oldParentId = getParentId(moved)
  let next = updateEntry(allEntries, movedId, { parentId: parentId ?? undefined })
  const siblings = sortDocumentNoteEntries(
    next.filter((e) => getParentId(e) === parentId && e.id !== movedId),
    'manual'
  )
  const targetIdx = siblings.findIndex((e) => e.id === targetId)
  const reordered = [...siblings]
  reordered.splice(Math.max(0, targetIdx), 0, { ...moved, parentId: parentId ?? undefined })
  const order = new Map(reordered.map((e, i) => [e.id, i]))
  next = next.map((e) => {
    if (getParentId(e) !== parentId) return e
    const idx = order.get(e.id)
    return idx == null ? e : { ...e, sortIndex: idx }
  })
  if (oldParentId !== parentId) {
    next = renormalizeSiblingsByParent(next, oldParentId)
  }
  return next
}

/** 移到目标笔记之后（同级，可跨文档） */
export function moveEntryAfterSibling(
  allEntries: DocumentNoteEntry[],
  movedId: string,
  targetId: string
): DocumentNoteEntry[] {
  const target = allEntries.find((e) => e.id === targetId)
  const moved = allEntries.find((e) => e.id === movedId)
  if (!target || !moved) return allEntries
  if (wouldCreateCycle(allEntries, movedId, getParentId(target))) return allEntries

  const parentId = getParentId(target)
  const oldParentId = getParentId(moved)
  let next = updateEntry(allEntries, movedId, { parentId: parentId ?? undefined })
  const siblings = sortDocumentNoteEntries(
    next.filter((e) => getParentId(e) === parentId && e.id !== movedId),
    'manual'
  )
  const targetIdx = siblings.findIndex((e) => e.id === targetId)
  const reordered = [...siblings]
  reordered.splice(targetIdx + 1, 0, { ...moved, parentId: parentId ?? undefined })
  const order = new Map(reordered.map((e, i) => [e.id, i]))
  next = next.map((e) => {
    if (getParentId(e) !== parentId) return e
    const idx = order.get(e.id)
    return idx == null ? e : { ...e, sortIndex: idx }
  })
  if (oldParentId !== parentId) {
    next = renormalizeSiblingsByParent(next, oldParentId)
  }
  return next
}

/** 缩进：成为前一条同级笔记的子笔记 */
export function nestUnderPreviousSibling(
  allEntries: DocumentNoteEntry[],
  entryId: string
): DocumentNoteEntry[] {
  const entry = allEntries.find((e) => e.id === entryId)
  if (!entry) return allEntries
  const parentId = getParentId(entry)
  const siblings = getNotebookChildren(allEntries, parentId, 'manual')
  const idx = siblings.findIndex((e) => e.id === entryId)
  if (idx <= 0) return allEntries
  const prev = siblings[idx - 1]!
  return nestEntryUnder(allEntries, entryId, prev.id)
}

/** 反缩进：提升到父笔记外（与父笔记同级） */
export function promoteEntry(
  allEntries: DocumentNoteEntry[],
  entryId: string
): DocumentNoteEntry[] {
  const entry = allEntries.find((e) => e.id === entryId)
  if (!entry?.parentId) return allEntries
  const parent = allEntries.find((e) => e.id === entry.parentId)
  if (!parent) return allEntries
  const newParentId = getParentId(parent)
  const oldParentId = entry.parentId
  let next = updateEntry(allEntries, entryId, {
    parentId: newParentId ?? undefined,
    sortIndex: nextSortIndexForParent(allEntries, newParentId)
  })
  next = renormalizeSiblingsByParent(next, oldParentId)
  return renormalizeSiblingsByParent(next, newParentId)
}

export function collectDeleteTargets(
  allEntries: DocumentNoteEntry[],
  entryId: string
): DocumentNoteEntry[] {
  const toRemove = descendantIds(allEntries, entryId)
  toRemove.add(entryId)
  return allEntries.filter((e) => toRemove.has(e.id))
}

export function deleteEntryCascade(
  allEntries: DocumentNoteEntry[],
  entryId: string
): DocumentNoteEntry[] {
  const toRemove = descendantIds(allEntries, entryId)
  toRemove.add(entryId)
  const removed = allEntries.filter((e) => !toRemove.has(e.id))
  const victim = allEntries.find((e) => e.id === entryId)
  if (!victim) return removed
  return renormalizeSiblingsByParent(removed, getParentId(victim))
}

export function restoreDeletedEntries(
  current: DocumentNoteEntry[],
  restored: DocumentNoteEntry[]
): DocumentNoteEntry[] {
  const existing = new Set(current.map((e) => e.id))
  const toAdd = restored.filter((e) => !existing.has(e.id))
  return [...current, ...toAdd]
}

/** 在指定笔记下插入子节点 */
export function insertEntryAsChild(
  entries: DocumentNoteEntry[],
  parentEntryId: string,
  newEntry: DocumentNoteEntry
): DocumentNoteEntry[] {
  const parent = entries.find((e) => e.id === parentEntryId)
  if (!parent) return [...entries, newEntry]
  const withParent: DocumentNoteEntry = {
    ...newEntry,
    parentId: parentEntryId,
    sortIndex: nextSortIndexForParent(entries, parentEntryId)
  }
  return [...entries, withParent]
}

export function insertEntryAfter(
  entries: DocumentNoteEntry[],
  afterEntryId: string,
  newEntry: DocumentNoteEntry
): DocumentNoteEntry[] {
  const after = entries.find((e) => e.id === afterEntryId)
  if (!after) return [...entries, newEntry]
  const parentId = getParentId(after)
  const withParent = {
    ...newEntry,
    parentId: parentId ?? undefined,
    sortIndex: nextSortIndexForParent(entries, parentId)
  }
  const next = [...entries, withParent]
  return moveEntryAfterSibling(next, withParent.id, afterEntryId)
}
