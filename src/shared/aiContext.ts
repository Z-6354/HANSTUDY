/** AI 对话上下文引用（仅展示在对话区，不在文件树出现） */
import type { DocumentNoteAnchor } from './documentNotes'

export type ChatContextItemKind = 'document' | 'note'

export interface ChatContextItem {
  id: string
  kind: ChatContextItemKind
  label: string
  content: string
  /** 副标题，如页码 / 笔记来源 */
  hint?: string
  /** 文档路径（kind=document 时用于关闭文档后自动移除） */
  docPath?: string
  /** 笔记条目 id（kind=note 时去重） */
  noteEntryId?: string
  /** 笔记/文档锚点（点击 chip 跳转） */
  anchor?: DocumentNoteAnchor
  /** 笔记所在笔记本 id（跨笔记本跳转） */
  notebookId?: string
}

/** 持久化到消息 / 历史列表的上下文快照（不含正文） */
export interface ChatContextSnapshot {
  kind: ChatContextItemKind
  label: string
  hint?: string
  docPath?: string
  noteEntryId?: string
  anchor?: DocumentNoteAnchor
  notebookId?: string
}

export function snapshotChatContextItems(items: ChatContextItem[]): ChatContextSnapshot[] {
  return items.map(({ kind, label, hint, noteEntryId, notebookId, docPath, anchor }) => ({
    kind,
    label,
    hint,
    noteEntryId,
    notebookId,
    docPath,
    anchor
  }))
}

export function snapshotToContextItem(snapshot: ChatContextSnapshot): ChatContextItem {
  return {
    id: snapshot.noteEntryId ?? snapshot.docPath ?? `${snapshot.kind}-${snapshot.label}`,
    kind: snapshot.kind,
    label: snapshot.label,
    content: '',
    hint: snapshot.hint,
    noteEntryId: snapshot.noteEntryId,
    notebookId: snapshot.notebookId,
    docPath: snapshot.docPath,
    anchor: snapshot.anchor
  }
}

export function formatContextChipLabel(
  item: Pick<ChatContextSnapshot, 'kind' | 'label' | 'hint'>
): string {
  if (item.kind === 'note') {
    return `笔记 · ${item.label}${item.hint ? ` · ${item.hint}` : ''}`
  }
  return item.hint ? `${item.label} · ${item.hint}` : item.label
}

export function canNavigateContextSnapshot(item: ChatContextSnapshot): boolean {
  return (
    (item.kind === 'note' && Boolean(item.noteEntryId)) ||
    (item.kind === 'document' && Boolean(item.docPath))
  )
}

export function collectSessionContextNotes(
  messages: Array<{ role: string; contextItems?: ChatContextSnapshot[] }>
): ChatContextSnapshot[] {
  const seen = new Set<string>()
  const refs: ChatContextSnapshot[] = []
  for (const msg of messages) {
    if (msg.role !== 'user' || !msg.contextItems?.length) continue
    for (const item of msg.contextItems) {
      if (item.kind !== 'note') continue
      const key = item.noteEntryId ?? `${item.label}:${item.hint ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      refs.push(item)
    }
  }
  return refs
}

export function mergeChatContextItems(items: ChatContextItem[]): {
  fileName: string
  content: string
} | undefined {
  if (items.length === 0) return undefined
  return {
    fileName: items.map((i) => i.label).join('、'),
    content: items
      .map((i) => {
        const head = i.hint ? `【${i.label} · ${i.hint}】` : `【${i.label}】`
        return `${head}\n${i.content}`
      })
      .join('\n\n---\n\n')
  }
}
