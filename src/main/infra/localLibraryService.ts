import { existsSync, realpathSync } from 'fs'
import { mkdir } from 'fs/promises'
import { resolve } from 'path'
import type { FileEntry } from '../../shared/types'
import { resolveLocalLibraryRoot } from '../config/appEnvironment'
import {
  importFilesToDirectory,
  listDirectory,
  type ImportResult
} from './fileService'

export function getLocalLibraryRoot(): string {
  return resolveLocalLibraryRoot()
}

export async function ensureLocalLibraryDir(): Promise<string> {
  const root = getLocalLibraryRoot()
  if (!existsSync(root)) {
    await mkdir(root, { recursive: true })
  }
  return root
}

export async function listLocalLibraryFiles(): Promise<FileEntry[]> {
  const root = await ensureLocalLibraryDir()
  return listDirectory(root)
}

export async function importFilesToLocalLibrary(sourcePaths: string[]): Promise<ImportResult[]> {
  const root = await ensureLocalLibraryDir()
  return importFilesToDirectory(root, sourcePaths)
}

function resolvePathForCompare(filePath: string): string {
  const absolute = resolve(filePath)
  try {
    if (existsSync(absolute)) return realpathSync.native(absolute)
  } catch {
    // ignore
  }
  return absolute
}

export function isLocalLibraryPath(filePath: string): boolean {
  const root = resolvePathForCompare(getLocalLibraryRoot())
  const target = resolvePathForCompare(filePath)
  const normalizedRoot = root.replace(/\\/g, '/').toLowerCase()
  const normalized = target.replace(/\\/g, '/').toLowerCase()
  return normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`)
}
