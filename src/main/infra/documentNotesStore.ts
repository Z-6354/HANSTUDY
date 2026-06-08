import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { app } from 'electron'
import type { DocumentNoteThread } from '../../shared/documentNotes'

const DIR_NAME = 'document-notes'

export function documentNotesRoot(): string {
  return join(app.getPath('userData'), DIR_NAME)
}

function docNotesPath(docPath: string): string {
  const id = createHash('sha256').update(docPath).digest('hex').slice(0, 24)
  return join(documentNotesRoot(), `${id}.json`)
}

function assertUnderRoot(filePath: string): void {
  const root = resolve(documentNotesRoot())
  const resolved = resolve(filePath)
  if (!resolved.startsWith(root)) {
    throw new Error('路径不在文档笔记目录内')
  }
}

export async function ensureDocumentNotesRoot(): Promise<string> {
  const root = documentNotesRoot()
  await mkdir(root, { recursive: true })
  return root
}

export async function getDocumentNotes(docPath: string): Promise<DocumentNoteThread | null> {
  await ensureDocumentNotesRoot()
  const filePath = docNotesPath(docPath)
  assertUnderRoot(filePath)
  try {
    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as DocumentNoteThread
    if (parsed.docPath !== docPath) {
      parsed.docPath = docPath
    }
    return parsed
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export async function saveDocumentNotes(thread: DocumentNoteThread): Promise<void> {
  await ensureDocumentNotesRoot()
  const filePath = docNotesPath(thread.docPath)
  assertUnderRoot(filePath)
  const next: DocumentNoteThread = {
    ...thread,
    updatedAt: new Date().toISOString()
  }
  await writeFile(filePath, JSON.stringify(next, null, 2), 'utf-8')
}
