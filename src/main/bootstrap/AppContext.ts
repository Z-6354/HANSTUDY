import type { BrowserWindow } from 'electron'
import { Agent } from '../agent/Agent'
import { HitlToolRegistry } from '../hitl/HitlToolRegistry'
import { LlmClient } from '../llm/LlmClient'
import { McpServerManager } from '../mcp/McpServerManager'
import { ToolRegistry } from '../tool/ToolRegistry'

export class AppContext {
  mainWindow: BrowserWindow | null = null
  readonly activeAiAborts = new Map<string, AbortController>()
  readonly llmClient = new LlmClient()
  readonly toolRegistry = new ToolRegistry()
  readonly mcpManager = new McpServerManager()
  hitlRegistry: HitlToolRegistry | null = null
  agent: Agent | null = null
  projectRoot: string | null = null
  agentReadableRoots: string[] = []
  loadedFolder: string | null = null

  initAgentStack(): void {
    this.hitlRegistry = new HitlToolRegistry(
      this.toolRegistry,
      () => this.mainWindow?.webContents ?? null
    )
    this.agent = new Agent(this.llmClient, this.hitlRegistry)
  }

  /** HanStudy 项目根（MCP 配置解析用）。 */
  setProjectRoot(root: string | null): void {
    this.projectRoot = root
    this.mcpManager.setProjectRoot(root)
  }

  /** Agent 固定可读根目录（workspace/、.hanstudy/）。 */
  setAgentReadableRoots(roots: string[]): void {
    this.agentReadableRoots = roots
    this.toolRegistry.pathGuard.setAgentRoots(roots)
  }

  /** 资源管理器当前打开的文件夹。 */
  setLoadedFolder(folder: string | null): void {
    this.loadedFolder = folder
    this.toolRegistry.pathGuard.setLoadedFolder(folder)
  }
}

let ctx: AppContext | null = null

export function getAppContext(): AppContext {
  if (!ctx) ctx = new AppContext()
  return ctx
}

export function resetAppContextForTests(): void {
  ctx = null
}
