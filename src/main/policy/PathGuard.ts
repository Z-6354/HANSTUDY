import { app } from 'electron'
import { resolve, relative, isAbsolute } from 'path'
import { fileURLToPath } from 'url'

/** 将 file:/// 或普通路径统一为本地绝对路径（供 PathGuard 与工具入参使用）。 */
export function normalizeLocalFilePath(filePath: string): string {
  const trimmed = filePath.trim()
  if (/^file:\/\//i.test(trimmed)) {
    return fileURLToPath(trimmed)
  }
  return trimmed
}

export class PathGuard {
  private agentRoots: string[] = []
  private loadedFolder: string | null = null
  private allowedRoots: string[] = [resolve(app.getPath('userData'))]

  /** Agent 固定可读根目录（workspace/、.hanstudy/ 等）。 */
  setAgentRoots(roots: string[]): void {
    this.agentRoots = roots.filter((r) => r?.trim()).map((r) => resolve(r.trim()))
    this.rebuildAllowedRoots()
  }

  /** 资源管理器当前打开的文件夹（动态扩展 Agent 可读范围）。 */
  setLoadedFolder(folder: string | null): void {
    this.loadedFolder = folder?.trim() ? resolve(folder.trim()) : null
    this.rebuildAllowedRoots()
  }

  /** @deprecated 使用 setAgentRoots */
  setWorkspaceRoot(root: string | null): void {
    this.setAgentRoots(root ? [root] : [])
  }

  private rebuildAllowedRoots(): void {
    const seen = new Set<string>()
    const roots: string[] = []
    const add = (path: string): void => {
      const normalized = resolve(path)
      if (seen.has(normalized)) return
      seen.add(normalized)
      roots.push(normalized)
    }
    add(app.getPath('userData'))
    for (const root of this.agentRoots) add(root)
    if (this.loadedFolder) add(this.loadedFolder)
    this.allowedRoots = roots
  }

  assertAllowed(filePath: string): void {
    this.resolveAllowed(filePath)
  }

  /** 规范化路径并校验可读范围，返回本地绝对路径。 */
  resolveAllowed(filePath: string): string {
    const normalized = resolve(normalizeLocalFilePath(filePath))
    const ok = this.allowedRoots.some((root) => {
      const rel = relative(resolve(root), normalized)
      return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
    })
    if (!ok) {
      throw new Error(`路径不在允许范围内: ${filePath}`)
    }
    return normalized
  }
}
