import { app } from 'electron'
import { existsSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { McpConfigFile, McpServerConfig } from '../../shared/mcp/types'

const DEFAULT_CONFIG: McpConfigFile = { servers: [] }

export class McpConfigLoader {
  private userPath(): string {
    return join(app.getPath('userData'), 'mcp.json')
  }

  async load(projectRoot: string | null): Promise<McpConfigFile> {
    const merged: McpServerConfig[] = []
    const user = await this.readFile(this.userPath())
    merged.push(...user.servers)

    if (projectRoot) {
      const projectPath = join(projectRoot, '.hanstudy', 'mcp.json')
      if (existsSync(projectPath)) {
        const project = await this.readFile(projectPath)
        for (const s of project.servers) {
          const idx = merged.findIndex((m) => m.id === s.id)
          if (idx >= 0) merged[idx] = s
          else merged.push(s)
        }
      }
    }
    return { servers: merged }
  }

  async saveUser(config: McpConfigFile): Promise<void> {
    const path = this.userPath()
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, JSON.stringify(config, null, 2), 'utf-8')
  }

  private async readFile(path: string): Promise<McpConfigFile> {
    if (!existsSync(path)) return DEFAULT_CONFIG
    try {
      const raw = await readFile(path, 'utf-8')
      const parsed = JSON.parse(raw) as McpConfigFile
      return { servers: parsed.servers ?? [] }
    } catch {
      return DEFAULT_CONFIG
    }
  }
}
