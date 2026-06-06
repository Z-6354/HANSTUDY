import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import type { ChatMode } from '../../../shared/types'
import type { Skill, SkillChatMeta, SkillListItem } from '../../../shared/skills'
import { extractBuiltinSkills, installSkillFromDirectory } from './skillBuiltinExtractor'
import { formatLoadedSkillBodies, formatSkillIndex } from './skillIndexFormatter'
import { SkillRegistry } from './skillRegistry'
import { selectSkillsForChat, shouldIncludeSkillIndex } from './skillSelector'
import { SkillStateStore } from './skillStateStore'

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

export function getUserSkillsDir(): string {
  return paths?.userDir ?? join(app.getPath('userData'), 'data', 'skills')
}

export function getSkillWarnings(): string[] {
  return registry?.getWarnings() ?? []
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
  const autoLoaded = selectSkillsForChat(enabled, userMessage, chatMode, excluded)

  const parts: string[] = []
  if (shouldIncludeSkillIndex(chatMode, enabled.length)) {
    const index = formatSkillIndex(enabled)
    if (index) parts.push(index)
  }

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
  }
}
