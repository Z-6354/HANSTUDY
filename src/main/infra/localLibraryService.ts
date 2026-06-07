import { app } from 'electron'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import type { FileEntry } from '../../shared/types'
import {
  importFilesToDirectory,
  listDirectory,
  type ImportResult
} from './fileService'

export function getLocalLibraryRoot(): string {
  return join(app.getPath('userData'), 'data', 'local-library')
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

export function isLocalLibraryPath(filePath: string): boolean {
  const root = getLocalLibraryRoot()
  const normalized = filePath.replace(/\\/g, '/')
  const normalizedRoot = root.replace(/\\/g, '/')
  return normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`)
}
