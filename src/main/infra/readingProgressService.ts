import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { ReadingProgress, WorkspaceSession } from '../../shared/readingProgress'

const PROGRESS_FILE = 'reading-progress.json'
const SESSION_FILE = 'workspace-session.json'

async function dataDir(): Promise<string> {
  const dir = join(app.getPath('userData'), 'data')
  await mkdir(dir, { recursive: true })
  return dir
}

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(join(await dataDir(), fileName), 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJson(fileName: string, data: unknown): Promise<void> {
  await writeFile(join(await dataDir(), fileName), JSON.stringify(data, null, 2), 'utf-8')
}

export async function getReadingProgress(docPath: string): Promise<ReadingProgress | null> {
  const map = await readJson<Record<string, ReadingProgress>>(PROGRESS_FILE, {})
  return map[docPath] ?? null
}

export async function saveReadingProgress(progress: ReadingProgress): Promise<ReadingProgress> {
  const map = await readJson<Record<string, ReadingProgress>>(PROGRESS_FILE, {})
  const next: ReadingProgress = {
    ...map[progress.docPath],
    ...progress,
    docPath: progress.docPath,
    updatedAt: new Date().toISOString()
  }
  map[progress.docPath] = next
  await writeJson(PROGRESS_FILE, map)
  return next
}

export async function getWorkspaceSession(): Promise<WorkspaceSession | null> {
  return readJson<WorkspaceSession | null>(SESSION_FILE, null)
}

export async function saveWorkspaceSession(session: WorkspaceSession): Promise<void> {
  await writeJson(SESSION_FILE, {
    ...session,
    updatedAt: new Date().toISOString()
  })
}
