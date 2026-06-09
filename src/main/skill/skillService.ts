import { app } from 'electron'
import { existsSync } from 'fs'
import { rm } from 'fs/promises'
import { join } from 'path'
import type { ChatMode } from '../../shared/types'
import type { Skill, SkillChatMeta, SkillListItem } from '../../shared/skills'
import { extractBuiltinSkills, installSkillFromDirectory } from './skillBuiltinExtractor'
import { formatLoadedSkillBodies, formatSkillIndex } from './skillIndexFormatter'
import { SkillRegistry } from './skillRegistry'
import { selectSkillsForChat, shouldIncludeSkillIndex } from './skillSelector'
import { SkillStateStore } from './skillStateStore'
import { SkillContextBuffer } from './SkillContextBuffer'

export interface SkillPaths {
  builtinSource: string
  cacheRoot: string
  userDir: string
  stateFile: string
}

export interface SkillChatResolution {
  systemPromptExtra: string
  meta: SkillChatMeta
}

let registry: SkillRegistry | null = null
let paths: SkillPaths | null = null
let projectSkillsDir: string | null = null
const skillBuffers = new Map<string, SkillContextBuffer>()
let activeSkillChatRequestId: string | null = null

function resolveBuiltinSource(): string {
  const packaged = join(process.resourcesPath, 'skills')
  if (app.isPackaged && existsSync(packaged)) return packaged
  const devRoot = join(process.cwd(), 'resources', 'skills')
  if (existsSync(devRoot)) return devRoot
  return join(app.getAppPath(), 'resources', 'skills')
}

export function getSkillPaths(): SkillPaths {
  const dataDir = join(app.getPath('userData'), 'data')
  return {
    builtinSource: resolveBuiltinSource(),
    cacheRoot: join(dataDir, 'skills-cache'),
    userDir: join(dataDir, 'skills'),
    stateFile: join(dataDir, 'skills.json')
  }
}

export async function initSkillService(): Promise<void> {
  paths = getSkillPaths()
  const stateStore = new SkillStateStore(paths.stateFile)
  await extractBuiltinSkills(paths.builtinSource, paths.cacheRoot)
  registry = new SkillRegistry(paths.cacheRoot, paths.userDir, projectSkillsDir, stateStore)
  await registry.reloadAsync()
}

export function setProjectSkillsDir(rootFolder: string | null): void {
  projectSkillsDir = rootFolder ? join(rootFolder, '.hanstudy', 'skills') : null
  registry?.setProjectSkillsDir(projectSkillsDir)
}

export async function reloadSkills(): Promise<void> {
  if (!registry) return
  await registry.reloadAsync()
}

export async function listSkills(): Promise<SkillListItem[]> {
  if (!registry) return []
  const disabled = await registry.state.disabled()
  return registry.allSkills().map((skill) => toListItem(skill, !disabled.has(skill.name)))
}

export async function enableSkill(name: string): Promise<void> {
  if (!registry) throw new Error('Skill 服务未初始化')
  if (!registry.findAnySkill(name)) throw new Error(`未找到 Skill：${name}`)
  await registry.state.enable(name)
}

export async function disableSkill(name: string): Promise<void> {
  if (!registry) throw new Error('Skill 服务未初始化')
  if (!registry.findAnySkill(name)) throw new Error(`未找到 Skill：${name}`)
  await registry.state.disable(name)
}

export async function installSkill(sourceDir: string): Promise<string> {
  if (!registry || !paths) throw new Error('Skill 服务未初始化')
  const name = await installSkillFromDirectory(sourceDir, paths.userDir)
  await registry.reloadAsync()
  return name
}

export async function deleteSkill(name: string): Promise<void> {
  if (!registry || !paths) throw new Error('Skill 服务未初始化')
  const skill = registry.findAnySkill(name)
  if (!skill) throw new Error(`未找到 Skill：${name}`)
  if (skill.source !== 'user') {
    throw new Error('仅可删除用户安装的 Skill')
  }
  const dir = join(paths.userDir, name)
  await rm(dir, { recursive: true, force: true })
  await registry.state.enable(name)
  await registry.reloadAsync()
}

export function getUserSkillsDir(): string {
  return paths?.userDir ?? join(app.getPath('userData'), 'data', 'skills')
}

export function getSkillWarnings(): string[] {
  return registry?.getWarnings() ?? []
}

export function getSkillRegistry(): SkillRegistry | null {
  return registry
}

/** 为一次 Agent 对话创建独立 skill 缓冲区（对齐 hancli 每 Agent 实例一个 buffer） */
export function beginSkillContext(chatRequestId: string): void {
  activeSkillChatRequestId = chatRequestId
  skillBuffers.set(chatRequestId, new SkillContextBuffer())
}

export function endSkillContext(chatRequestId: string): void {
  skillBuffers.delete(chatRequestId)
  if (activeSkillChatRequestId === chatRequestId) {
    activeSkillChatRequestId = null
  }
}

export function drainSkillContext(chatRequestId: string): string {
  const buffer = skillBuffers.get(chatRequestId)
  if (!buffer || buffer.isEmpty()) return ''
  return buffer.drain()
}

export function clearSkillContext(chatRequestId: string): void {
  skillBuffers.get(chatRequestId)?.clear()
}

export async function loadSkillBody(name: string): Promise<string | null> {
  if (!registry) return null
  const skill = await registry.findSkill(name)
  return skill?.body ?? null
}

export async function pushSkillToActiveContext(name: string, body: string): Promise<boolean> {
  if (!activeSkillChatRequestId) return false
  const buffer = skillBuffers.get(activeSkillChatRequestId)
  if (!buffer) return false
  buffer.push(name, body)
  return true
}

export async function resolveSkillsForChat(
  userMessage: string,
  chatMode: ChatMode,
  excludedSkillNames: string[] = []
): Promise<SkillChatResolution> {
  if (!registry) {
    return { systemPromptExtra: '', meta: { activeSkills: [] } }
  }

  const excluded = new Set(excludedSkillNames)
  const enabled = await registry.enabledSkills()
  const autoLoaded =
    chatMode === 'reading'
      ? selectSkillsForChat(enabled, userMessage, chatMode, excluded)
      : []

  const parts: string[] = []
  if (shouldIncludeSkillIndex(chatMode, enabled.length)) {
    const index = formatSkillIndex(enabled)
    if (index) parts.push(index)
  }

  // reading 模式：自动注入匹配 skill 正文（产品向，hancli 无此步）
  // agent 模式：仅索引 + load_skill → SkillContextBuffer → 下一轮注入
  if (autoLoaded.length) {
    parts.push(formatLoadedSkillBodies(autoLoaded))
  }

  return {
    systemPromptExtra: parts.filter(Boolean).join('\n\n'),
    meta: {
      activeSkills: autoLoaded.map((skill) => ({
        name: skill.name,
        description: skill.description
      }))
    }
  }
}

function toListItem(skill: Skill, enabled: boolean): SkillListItem {
  return {
    name: skill.name,
    description: skill.description,
    version: skill.version,
    author: skill.author,
    tags: skill.tags,
    source: skill.source,
    skillMdPath: skill.skillMdPath,
    enabled
  }
}

export function getSkillSourceLabel(source: SkillListItem['source']): string {
  switch (source) {
    case 'builtin':
      return '内置'
    case 'user':
      return '用户'
    case 'project':
      return '项目'
    default:
      return source
  }
}
