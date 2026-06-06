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
  workspaceRoot: string | null = null

  initAgentStack(): void {
    this.hitlRegistry = new HitlToolRegistry(
      this.toolRegistry,
      () => this.mainWindow?.webContents ?? null
    )
    this.agent = new Agent(this.llmClient, this.hitlRegistry)
  }

  setWorkspaceRoot(root: string | null): void {
    this.workspaceRoot = root
    this.toolRegistry.pathGuard.setWorkspaceRoot(root)
    this.mcpManager.setProjectRoot(root)
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
