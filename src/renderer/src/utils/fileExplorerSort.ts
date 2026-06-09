import type { FileEntry } from '../types/global.d'
import { pathKey } from './pathKey'

export function sortFileEntries(
  entries: FileEntry[],
  favoritePaths: ReadonlySet<string>
): FileEntry[] {
  return [...entries].sort((a, b) => {
    const af = !a.isDirectory && favoritePaths.has(pathKey(a.path)) ? 0 : 1
    const bf = !b.isDirectory && favoritePaths.has(pathKey(b.path)) ? 0 : 1
    if (af !== bf) return af - bf
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-CN')
  })
}
