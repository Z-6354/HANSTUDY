import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { app } from 'electron'
import type { DocumentNoteEntry } from '../../shared/documentNotes'
import type { DocumentNoteThread } from '../../shared/documentNotes'
import { uniqueNotebookName } from '../../shared/notebookNames'
import {
  DEFAULT_NOTEBOOK_ID,
  type CreateNotebookInput,
  type Notebook,
  type NotebookMeta,
  type NotebooksIndex,
  type RenameNotebookInput
} from '../../shared/notebooks'
import { documentNotesRoot, ensureDocumentNotesRoot, getDocumentNotes } from './documentNotesStore'

const DIR_NAME = 'notebooks'
const INDEX_FILE = 'index.json'

export function notebooksRoot(): string {
  return join(app.getPath('userData'), DIR_NAME)
}

function notebookPath(id: string): string {
  return join(notebooksRoot(), `${id}.json`)
}

function indexPath(): string {
  return join(notebooksRoot(), INDEX_FILE)
}

function assertUnderRoot(filePath: string): void {
  const root = resolve(notebooksRoot())
  const resolved = resolve(filePath)
  if (!resolved.startsWith(root)) {
    throw new Error('路径不在笔记本目录内')
  }
}

function assertNotebookId(id: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error('无效的笔记本 ID')
  }
}

async function ensureNotebooksRoot(): Promise<string> {
  const root = notebooksRoot()
  await mkdir(root, { recursive: true })
  return root
}

function normalizeEntry(entry: DocumentNoteEntry, sortIndex: number): DocumentNoteEntry {
  return {
    ...entry,
    depth: entry.depth ?? 0,
    sortIndex: entry.sortIndex ?? sortIndex
  }
}

function metaFromNotebook(nb: Notebook): NotebookMeta {
  return {
    id: nb.id,
    name: nb.name,
    createdAt: nb.createdAt,
    updatedAt: nb.updatedAt,
    defaultSortMode: nb.defaultSortMode
  }
}

async function readIndex(): Promise<NotebooksIndex | null> {
  try {
    const raw = await readFile(indexPath(), 'utf-8')
    return JSON.parse(raw) as NotebooksIndex
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

async function writeIndex(index: NotebooksIndex): Promise<void> {
  await ensureNotebooksRoot()
  const path = indexPath()
  assertUnderRoot(path)
  await writeFile(path, JSON.stringify(index, null, 2), 'utf-8')
}

async function recoverNotebookFromIndex(id: string): Promise<Notebook | null> {
  const index = await readIndex()
  const meta = index?.notebooks.find((n) => n.id === id)
  if (!meta) return null
  const recovered: Notebook = {
    id: meta.id,
    name: meta.name,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    defaultSortMode: meta.defaultSortMode,
    linkedDocPaths: [],
    entries: []
  }
  await writeNotebookFile(recovered)
  return recovered
}

async function readNotebookFile(id: string): Promise<Notebook | null> {
  assertNotebookId(id)
  const path = notebookPath(id)
  assertUnderRoot(path)
  try {
    const raw = await readFile(path, 'utf-8')
    if (!raw.trim()) return recoverNotebookFromIndex(id)
    return JSON.parse(raw) as Notebook
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    if (err instanceof SyntaxError) return recoverNotebookFromIndex(id)
    throw err
  }
}

async function writeNotebookFile(notebook: Notebook): Promise<void> {
  await enqueueNotebookWrite(notebook.id, () => writeNotebookFileInner(notebook))
}

const notebookWriteTail = new Map<string, Promise<void>>()

function enqueueNotebookWrite(id: string, task: () => Promise<void>): Promise<void> {
  const prev = notebookWriteTail.get(id) ?? Promise.resolve()
  const next = prev.catch(() => undefined).then(task)
  notebookWriteTail.set(id, next)
  return next.finally(() => {
    if (notebookWriteTail.get(id) === next) notebookWriteTail.delete(id)
  })
}

async function writeNotebookFileInner(notebook: Notebook): Promise<void> {
  await ensureNotebooksRoot()
  const path = notebookPath(notebook.id)
  assertUnderRoot(path)
  const next: Notebook = {
    ...notebook,
    updatedAt: new Date().toISOString()
  }
  const content = JSON.stringify(next, null, 2)
  const tmp = `${path}.${randomUUID()}.tmp`
  assertUnderRoot(tmp)
  await writeFile(tmp, content, 'utf-8')
  try {
    await rename(tmp, path)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      await writeFile(path, content, 'utf-8')
      return
    }
    if (code === 'EEXIST' || code === 'EPERM') {
      await unlink(path).catch(() => undefined)
      await rename(tmp, path)
      return
    }
    throw err
  } finally {
    await unlink(tmp).catch(() => undefined)
  }
}

async function migrateLegacyDocumentNotes(): Promise<NotebooksIndex> {
  await ensureDocumentNotesRoot()
  const root = documentNotesRoot()
  let files: string[] = []
  try {
    files = await readdir(root)
  } catch {
    files = []
  }

  const entries: DocumentNoteEntry[] = []
  const linkedDocPaths: string[] = []
  let sortCounter = 0

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const raw = await readFile(join(root, file), 'utf-8')
      const thread = JSON.parse(raw) as DocumentNoteThread
      if (thread.docPath) linkedDocPaths.push(thread.docPath)
      for (const entry of thread.entries ?? []) {
        entries.push(normalizeEntry(entry, sortCounter++))
      }
    } catch {
      // skip corrupt legacy files
    }
  }

  const now = new Date().toISOString()
  const notebook: Notebook = {
    id: DEFAULT_NOTEBOOK_ID,
    name: '默认笔记本',
    createdAt: now,
    updatedAt: now,
    defaultSortMode: 'manual',
    linkedDocPaths: Array.from(new Set(linkedDocPaths)),
    entries
  }

  await writeNotebookFile(notebook)
  const index: NotebooksIndex = {
    version: 1,
    notebooks: [metaFromNotebook(notebook)],
    updatedAt: now
  }
  await writeIndex(index)
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      await unlink(join(root, file))
    } catch {
      // ignore cleanup failures
    }
  }
  return index
}

async function ensureIndex(): Promise<NotebooksIndex> {
  await ensureNotebooksRoot()
  const existing = await readIndex()
  if (existing && existing.notebooks.length > 0) return existing
  return migrateLegacyDocumentNotes()
}

export async function listNotebooks(): Promise<NotebooksIndex> {
  return ensureIndex()
}

export async function getNotebook(id: string): Promise<Notebook | null> {
  await ensureIndex()
  return readNotebookFile(id)
}

export async function saveNotebook(notebook: Notebook): Promise<void> {
  await ensureIndex()
  assertNotebookId(notebook.id)
  await writeNotebookFile(notebook)
  const index = await readIndex()
  if (!index) throw new Error('笔记本索引不存在')
  const meta = metaFromNotebook(notebook)
  const idx = index.notebooks.findIndex((n) => n.id === notebook.id)
  if (idx >= 0) index.notebooks[idx] = meta
  else index.notebooks.push(meta)
  index.updatedAt = new Date().toISOString()
  await writeIndex(index)
}

export async function createNotebook(input: CreateNotebookInput): Promise<Notebook> {
  await ensureIndex()
  const index = await readIndex()
  const existingNames = index?.notebooks.map((n) => n.name) ?? []
  const name = uniqueNotebookName(input.name, existingNames)
  if (!name) throw new Error('笔记本名称不能为空')
  const now = new Date().toISOString()
  const id = `notebook-${randomUUID().slice(0, 8)}`
  const notebook: Notebook = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    defaultSortMode: input.defaultSortMode ?? 'manual',
    linkedDocPaths: [],
    entries: []
  }
  await saveNotebook(notebook)
  return notebook
}

export async function renameNotebook(input: RenameNotebookInput): Promise<Notebook> {
  await ensureIndex()
  const trimmed = input.name.trim()
  if (!trimmed) throw new Error('笔记本名称不能为空')
  const notebook = await readNotebookFile(input.id)
  if (!notebook) throw new Error('笔记本不存在')
  const index = await readIndex()
  const existingNames =
    index?.notebooks.filter((n) => n.id !== input.id).map((n) => n.name) ?? []
  const name = uniqueNotebookName(trimmed, existingNames)
  const updated: Notebook = {
    ...notebook,
    name,
    updatedAt: new Date().toISOString()
  }
  await saveNotebook(updated)
  return updated
}

export async function deleteNotebook(id: string): Promise<void> {
  if (id === DEFAULT_NOTEBOOK_ID) throw new Error('无法删除默认笔记本')
  await ensureIndex()
  const index = await readIndex()
  if (!index) return
  index.notebooks = index.notebooks.filter((n) => n.id !== id)
  index.updatedAt = new Date().toISOString()
  await writeIndex(index)
  const path = notebookPath(id)
  assertUnderRoot(path)
  const { unlink } = await import('node:fs/promises')
  try {
    await unlink(path)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}

/** 笔记本侧关联文档（文档实体无反向引用） */
export async function linkDocumentToNotebook(
  notebookId: string,
  docPath: string
): Promise<Notebook> {
  const trimmed = docPath.trim()
  if (!trimmed) throw new Error('文档路径无效')
  const notebook = await getNotebook(notebookId)
  if (!notebook) throw new Error('笔记本不存在')
  if (notebook.linkedDocPaths.includes(trimmed)) return notebook
  const next: Notebook = {
    ...notebook,
    linkedDocPaths: [...notebook.linkedDocPaths, trimmed]
  }
  await saveNotebook(next)
  return next
}

/** 按需从旧 per-doc 存储补全条目（仅默认笔记本、首次打开某文档时） */
export async function importLegacyThreadIfNeeded(
  notebookId: string,
  docPath: string
): Promise<Notebook | null> {
  if (notebookId !== DEFAULT_NOTEBOOK_ID) {
    return getNotebook(notebookId)
  }
  const notebook = await getNotebook(notebookId)
  if (!notebook) return null
  const hasEntries = notebook.entries.some((e) => e.anchor.docPath === docPath)
  if (hasEntries) return notebook

  const legacy = await getDocumentNotes(docPath)
  if (!legacy || legacy.entries.length === 0) return notebook

  let sortCounter =
    notebook.entries.reduce((max, e) => Math.max(max, e.sortIndex ?? 0), -1) + 1
  const imported = legacy.entries.map((e) => normalizeEntry(e, sortCounter++))
  const linked = notebook.linkedDocPaths.includes(docPath)
    ? notebook.linkedDocPaths
    : [...notebook.linkedDocPaths, docPath]

  const next: Notebook = {
    ...notebook,
    linkedDocPaths: linked,
    entries: [...notebook.entries, ...imported]
  }
  await saveNotebook(next)
  return next
}

export async function ensureDefaultNotebook(): Promise<Notebook> {
  const index = await ensureIndex()
  const firstId = index.notebooks[0]?.id ?? DEFAULT_NOTEBOOK_ID
  const nb = await getNotebook(firstId)
  if (nb) return nb
  return createNotebook({ name: '默认笔记本', defaultSortMode: 'manual' })
}

