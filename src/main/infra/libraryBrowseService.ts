import { stat } from 'fs/promises'
import { extname, join, relative, resolve } from 'path'
import { matchGlob } from '../../shared/globMatch'
import type { FileEntry } from '../../shared/types'
import {
  getFileType,
  isSupportedDocumentPath,
  listDirectory,
  readTextFile,
  getDocumentContext
} from './fileService'
import {
  ensureLocalLibraryDir,
  getLocalLibraryRoot,
  isLocalLibraryPath
} from './localLibraryService'
import { listReadingProgressIndex } from './readingProgressService'

export const DEFAULT_LIST_LIBRARY_MAX_ENTRIES = 200
export const DEFAULT_SEARCH_MAX_RESULTS = 40
export const DEFAULT_SEARCH_MAX_FILES = 120
export const MAX_SEARCH_FILE_BYTES = 2 * 1024 * 1024
export const MAX_SEARCH_HITS_PER_FILE = 8

const SEARCH_EXCLUDED_DIRS = new Set([
  '.git',
  '.hanstudy',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.idea'
])

export interface LibraryEntryInfo {
  name: string
  path: string
  isDirectory: boolean
  extension?: string
  fileType?: ReturnType<typeof getFileType>
  lastReadAt?: string
}

export interface LibrarySearchHit {
  path: string
  fileName: string
  line: number
  text: string
}

export function resolvePathUnderLocalLibrary(pathArg?: string): string {
  const root = getLocalLibraryRoot()
  const trimmed = pathArg?.trim()
  const target = trimmed ? resolve(root, trimmed) : resolve(root)
  if (!isLocalLibraryPath(target)) {
    throw new Error(`路径不在资料库内: ${pathArg ?? ''}`)
  }
  return target
}

export async function listLibraryEntries(options: {
  path?: string
  recursive?: boolean
  maxEntries?: number
}): Promise<LibraryEntryInfo[]> {
  const dir = resolvePathUnderLocalLibrary(options.path)
  const maxEntries = clamp(
    options.maxEntries ?? DEFAULT_LIST_LIBRARY_MAX_ENTRIES,
    1,
    500
  )
  const progressIndex = await listReadingProgressIndex()

  const raw: FileEntry[] = options.recursive
    ? await collectLibraryFiles(dir)
    : await listDirectory(dir)

  const out: LibraryEntryInfo[] = []
  for (const entry of raw) {
    if (out.length >= maxEntries) break
    if (entry.isDirectory && SEARCH_EXCLUDED_DIRS.has(entry.name)) continue
    if (!entry.isDirectory && !isSupportedDocumentPath(entry.path)) continue

    const info: LibraryEntryInfo = {
      name: entry.name,
      path: entry.path,
      isDirectory: entry.isDirectory
    }
    if (!entry.isDirectory) {
      info.extension = extname(entry.name).toLowerCase()
      info.fileType = getFileType(entry.path)
      const prog = progressIndex[entry.path]
      if (prog?.updatedAt) info.lastReadAt = prog.updatedAt
    }
    out.push(info)
  }

  return out
}

async function collectLibraryFiles(dir: string): Promise<FileEntry[]> {
  const result: FileEntry[] = []

  async function walk(current: string): Promise<void> {
    const entries = await listDirectory(current)
    for (const entry of entries) {
      if (entry.isDirectory) {
        if (SEARCH_EXCLUDED_DIRS.has(entry.name)) continue
        await walk(entry.path)
      } else if (isSupportedDocumentPath(entry.path)) {
        result.push(entry)
      }
    }
  }

  await walk(dir)
  return result
}

export async function globLibraryFiles(options: {
  pattern: string
  path?: string
  maxResults?: number
}): Promise<LibraryEntryInfo[]> {
  const pattern = options.pattern?.trim()
  if (!pattern) {
    throw new Error('pattern 不能为空')
  }

  const dir = resolvePathUnderLocalLibrary(options.path)
  await ensureLocalLibraryDir()
  const root = getLocalLibraryRoot()
  const maxResults = clamp(options.maxResults ?? 50, 1, 200)
  const progressIndex = await listReadingProgressIndex()
  const files = await collectLibraryFiles(dir)
  const out: LibraryEntryInfo[] = []

  for (const file of files) {
    if (out.length >= maxResults) break
    const rel = relative(root, file.path).replace(/\\/g, '/')
    if (!matchGlob(pattern, rel) && !matchGlob(pattern, file.name)) continue

    const prog = progressIndex[file.path]
    out.push({
      name: file.name,
      path: file.path,
      isDirectory: false,
      extension: extname(file.name).toLowerCase(),
      fileType: getFileType(file.path),
      lastReadAt: prog?.updatedAt
    })
  }

  return out
}

export async function searchInLibrary(options: {
  query: string
  path?: string
  maxResults?: number
  maxFiles?: number
}): Promise<LibrarySearchHit[]> {
  const query = options.query.trim()
  if (!query) return []

  const dir = resolvePathUnderLocalLibrary(options.path)
  await ensureLocalLibraryDir()

  const maxResults = clamp(options.maxResults ?? DEFAULT_SEARCH_MAX_RESULTS, 1, 100)
  const maxFiles = clamp(options.maxFiles ?? DEFAULT_SEARCH_MAX_FILES, 1, 300)
  const needle = query.toLowerCase()

  const files = await collectLibraryFiles(dir)
  const hits: LibrarySearchHit[] = []
  let scanned = 0

  for (const file of files) {
    if (scanned >= maxFiles || hits.length >= maxResults) break
    scanned++

    try {
      const fileStat = await stat(file.path)
      if (fileStat.size > MAX_SEARCH_FILE_BYTES) continue

      const text = await loadSearchableText(file.path)
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
      let fileHits = 0

      for (let i = 0; i < lines.length; i++) {
        if (hits.length >= maxResults || fileHits >= MAX_SEARCH_HITS_PER_FILE) break
        if (!lines[i]!.toLowerCase().includes(needle)) continue
        hits.push({
          path: file.path,
          fileName: file.name,
          line: i + 1,
          text: lines[i]!.trim()
        })
        fileHits++
      }
    } catch {
      // skip unreadable files
    }
  }

  return hits
}

async function loadSearchableText(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.txt' || ext === '.md') {
    return readTextFile(filePath)
  }
  const ctx = await getDocumentContext(filePath)
  return ctx.content
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
