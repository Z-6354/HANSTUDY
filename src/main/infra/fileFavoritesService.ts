import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { FileFavoritesFile } from '../../shared/fileFavorites'

const FAVORITES_FILE = 'file-favorites.json'

function normalizePathKey(filePath: string): string {
  return filePath.replace(/\\/g, '/').toLowerCase()
}

async function dataDir(): Promise<string> {
  const dir = join(app.getPath('userData'), 'data')
  await mkdir(dir, { recursive: true })
  return dir
}

async function readFavorites(): Promise<FileFavoritesFile> {
  try {
    const raw = await readFile(join(await dataDir(), FAVORITES_FILE), 'utf-8')
    const parsed = JSON.parse(raw) as FileFavoritesFile
    return { paths: parsed.paths ?? [], updatedAt: parsed.updatedAt ?? new Date().toISOString() }
  } catch {
    return { paths: [], updatedAt: new Date().toISOString() }
  }
}

async function writeFavorites(data: FileFavoritesFile): Promise<void> {
  await writeFile(
    join(await dataDir(), FAVORITES_FILE),
    JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2),
    'utf-8'
  )
}

export async function listFavoritePaths(): Promise<string[]> {
  const data = await readFavorites()
  return data.paths
}

export async function isFavoritePath(filePath: string): Promise<boolean> {
  const key = normalizePathKey(filePath)
  const data = await readFavorites()
  return data.paths.some((p) => normalizePathKey(p) === key)
}

export async function toggleFavoritePath(filePath: string): Promise<boolean> {
  const trimmed = filePath.trim()
  if (!trimmed) return false

  const data = await readFavorites()
  const key = normalizePathKey(trimmed)
  const idx = data.paths.findIndex((p) => normalizePathKey(p) === key)
  if (idx >= 0) {
    data.paths.splice(idx, 1)
    await writeFavorites(data)
    return false
  }
  data.paths.unshift(trimmed)
  await writeFavorites(data)
  return true
}

export async function removeFavoritePath(filePath: string): Promise<void> {
  const data = await readFavorites()
  const key = normalizePathKey(filePath)
  const next = data.paths.filter((p) => normalizePathKey(p) !== key)
  if (next.length === data.paths.length) return
  data.paths = next
  await writeFavorites(data)
}

export async function renameFavoritePath(oldPath: string, newPath: string): Promise<void> {
  const data = await readFavorites()
  const oldKey = normalizePathKey(oldPath)
  const idx = data.paths.findIndex((p) => normalizePathKey(p) === oldKey)
  if (idx < 0) return
  data.paths[idx] = newPath
  await writeFavorites(data)
}
