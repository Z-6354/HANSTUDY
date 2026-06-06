import { app } from 'electron'
import { resolve, relative, isAbsolute } from 'path'

export class PathGuard {
  private allowedRoots: string[] = []

  setWorkspaceRoot(root: string | null): void {
    this.allowedRoots = [app.getPath('userData')]
    if (root?.trim()) {
      this.allowedRoots.push(resolve(root.trim()))
    }
  }

  assertAllowed(filePath: string): void {
    const normalized = resolve(filePath)
    const ok = this.allowedRoots.some((root) => {
      const rel = relative(resolve(root), normalized)
      return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
    })
    if (!ok) {
      throw new Error(`路径不在允许范围内: ${filePath}`)
    }
  }
}
