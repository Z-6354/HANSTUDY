import { mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import { app } from 'electron'
import type { NoteEntry } from '../../shared/notes'

const NOTES_DIR_NAME = 'notes'

export function notesRoot(): string {
  return join(app.getPath('userData'), NOTES_DIR_NAME)
}

export async function ensureNotesRoot(): Promise<string> {
  const root = notesRoot()
  await mkdir(root, { recursive: true })
  return root
}

export async function listNotesDirectory(dirPath?: string): Promise<NoteEntry[]> {
  const root = await ensureNotesRoot()
  const target = dirPath ?? root
  const entries = await readdir(target, { withFileTypes: true })
  const result: NoteEntry[] = []

  for (const entry of entries) {
    const fullPath = join(target, entry.name)
    if (entry.isDirectory()) {
      result.push({ name: entry.name, path: fullPath, isDirectory: true })
      continue
    }
    if (extname(entry.name).toLowerCase() === '.md') {
      result.push({ name: entry.name, path: fullPath, isDirectory: false })
    }
  }

  return result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function readNote(filePath: string): Promise<string> {
  assertUnderNotesRoot(filePath)
  return readFile(filePath, 'utf-8')
}

export async function writeNote(filePath: string, content: string): Promise<void> {
  assertUnderNotesRoot(filePath)
  await writeFile(filePath, content, 'utf-8')
}

export async function appendNote(filePath: string, chunk: string): Promise<void> {
  assertUnderNotesRoot(filePath)
  const existing = await readFile(filePath, 'utf-8').catch(() => '')
  const separator = existing.trim() ? '\n\n' : ''
  await writeFile(filePath, existing + separator + chunk, 'utf-8')
}

export async function createNoteFile(dirPath: string, fileName: string): Promise<string> {
  const root = await ensureNotesRoot()
  const parent = dirPath || root
  assertUnderNotesRoot(parent)
  const safeName = fileName.endsWith('.md') ? fileName : `${fileName}.md`
  const filePath = join(parent, safeName)
  await writeFile(filePath, `# ${basename(safeName, '.md')}\n\n`, 'utf-8')
  return filePath
}

export async function createNoteFolder(dirPath: string, folderName: string): Promise<string> {
  const root = await ensureNotesRoot()
  const parent = dirPath || root
  assertUnderNotesRoot(parent)
  const folderPath = join(parent, folderName)
  await mkdir(folderPath, { recursive: true })
  return folderPath
}

export async function deleteNoteEntry(targetPath: string): Promise<void> {
  assertUnderNotesRoot(targetPath)
  await rm(targetPath, { recursive: true, force: true })
}

export async function renameNoteEntry(targetPath: string, newName: string): Promise<string> {
  assertUnderNotesRoot(targetPath)
  const parent = join(targetPath, '..')
  const nextPath = join(parent, newName)
  const { rename } = await import('fs/promises')
  await rename(targetPath, nextPath)
  return nextPath
}

function assertUnderNotesRoot(targetPath: string): void {
  const root = notesRoot()
  const normalized = targetPath.replace(/\\/g, '/')
  const rootNorm = root.replace(/\\/g, '/')
  if (!normalized.startsWith(rootNorm)) {
    throw new Error('路径不在笔记库内')
  }
}

export async function noteExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath)
    return s.isFile()
  } catch {
    return false
  }
}
