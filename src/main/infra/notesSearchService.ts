import { readFile, stat } from 'fs/promises'
import { extname } from 'path'
import { listNotesDirectory } from './notesStore'

export const DEFAULT_SEARCH_NOTES_MAX_RESULTS = 40
export const DEFAULT_SEARCH_NOTES_MAX_FILES = 120
export const MAX_NOTE_SEARCH_FILE_BYTES = 512 * 1024

export interface NoteSearchHit {
  path: string
  fileName: string
  line: number
  text: string
}

async function collectNoteFiles(dir: string): Promise<Array<{ path: string; name: string }>> {
  const result: Array<{ path: string; name: string }> = []

  async function walk(current: string): Promise<void> {
    const entries = await listNotesDirectory(current)
    for (const entry of entries) {
      if (entry.isDirectory) {
        await walk(entry.path)
        continue
      }
      if (extname(entry.name).toLowerCase() === '.md') {
        result.push({ path: entry.path, name: entry.name })
      }
    }
  }

  await walk(dir)
  return result
}

export async function searchNotes(options: {
  rootDir: string
  query: string
  maxResults?: number
  maxFiles?: number
}): Promise<NoteSearchHit[]> {
  const query = options.query.trim()
  if (!query) return []

  const maxResults = clamp(options.maxResults ?? DEFAULT_SEARCH_NOTES_MAX_RESULTS, 1, 100)
  const maxFiles = clamp(options.maxFiles ?? DEFAULT_SEARCH_NOTES_MAX_FILES, 1, 300)
  const needle = query.toLowerCase()

  const files = await collectNoteFiles(options.rootDir)
  const hits: NoteSearchHit[] = []
  let scanned = 0

  for (const file of files) {
    if (scanned >= maxFiles || hits.length >= maxResults) break
    scanned++

    try {
      const fileStat = await stat(file.path)
      if (fileStat.size > MAX_NOTE_SEARCH_FILE_BYTES) continue
      const raw = await readFile(file.path, 'utf-8')
      const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (hits.length >= maxResults) break
        if (!lines[i]!.toLowerCase().includes(needle)) continue
        hits.push({
          path: file.path,
          fileName: file.name,
          line: i + 1,
          text: lines[i]!.trim()
        })
      }
    } catch {
      // skip unreadable notes
    }
  }

  return hits
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
