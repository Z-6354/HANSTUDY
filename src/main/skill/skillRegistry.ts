import { readdir, readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import type { Skill, SkillSource } from '../../shared/skills'
import { listField, parseSkillFrontmatter, stringField } from './skillFrontmatterParser'
import type { SkillStateStore } from './skillStateStore'

export class SkillRegistry {
  private readonly skillsByName = new Map<string, Skill>()
  private readonly warnings: string[] = []
  private projectSkillsDir: string | null

  constructor(
    private readonly builtinCacheRoot: string,
    private readonly userSkillsDir: string,
    projectSkillsDir: string | null,
    private readonly stateStore: SkillStateStore
  ) {
    this.projectSkillsDir = projectSkillsDir
  }

  setProjectSkillsDir(dir: string | null): void {
    this.projectSkillsDir = dir
  }

  async reloadAsync(): Promise<void> {
    this.skillsByName.clear()
    this.warnings.length = 0
    await this.loadDirectoryAsync(this.builtinCacheRoot, 'builtin')
    await this.loadDirectoryAsync(this.userSkillsDir, 'user')
    await this.loadDirectoryAsync(this.projectSkillsDir, 'project')
  }

  allSkills(): Skill[] {
    return Array.from(this.skillsByName.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  async enabledSkills(): Promise<Skill[]> {
    const disabled = await this.stateStore.disabled()
    return this.allSkills().filter((skill) => !disabled.has(skill.name))
  }

  async findSkill(name: string): Promise<Skill | null> {
    const skill = this.skillsByName.get(name)
    if (!skill) return null
    const disabled = await this.stateStore.disabled()
    return disabled.has(name) ? null : skill
  }

  findAnySkill(name: string): Skill | undefined {
    return this.skillsByName.get(name)
  }

  getWarnings(): string[] {
    return [...this.warnings]
  }

  get state(): SkillStateStore {
    return this.stateStore
  }

  private async loadDirectoryAsync(dir: string | null, source: SkillSource): Promise<void> {
    if (!dir || !existsSync(dir)) return

    try {
      const entries = await readdir(dir, { withFileTypes: true })
      const dirs = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(dir, entry.name))
        .sort()

      for (const skillDir of dirs) {
        const skillMd = join(skillDir, 'SKILL.md')
        try {
          const info = await stat(skillMd)
          if (!info.isFile()) continue
        } catch {
          continue
        }
        const skill = await this.parseSkill(skillDir, skillMd, source)
        if (skill) this.skillsByName.set(skill.name, skill)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.warnings.push(`扫描 skill 目录失败 ${dir}: ${message}`)
      console.warn(`[skills] 扫描 skill 目录失败 ${dir}:`, message)
    }
  }

  private async parseSkill(
    skillDir: string,
    skillMd: string,
    source: SkillSource
  ): Promise<Skill | null> {
    let content: string
    try {
      content = await readFile(skillMd, 'utf-8')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.warnings.push(`读取 SKILL.md 失败 ${skillMd}: ${message}`)
      console.warn(`[skills] 读取 SKILL.md 失败 ${skillMd}:`, message)
      return null
    }

    const parsed = parseSkillFrontmatter(content)
    for (const warning of parsed.warnings) {
      this.warnings.push(`${skillMd}: ${warning}`)
      console.warn(`[skills] ${skillMd} frontmatter: ${warning}`)
    }

    const fm = parsed.frontmatter
    let name = stringField(fm, 'name')
    if (!name?.trim()) {
      name = skillDir.split(/[/\\]/).pop() ?? 'unknown'
    }

    const description = stringField(fm, 'description') ?? ''
    const version = stringField(fm, 'version')
    const author = stringField(fm, 'author')
    const tags = listField(fm, 'tags')

    const referencesDir = join(skillDir, 'references')
    let referencesPath: string | undefined
    if (existsSync(referencesDir)) {
      try {
        const refStat = await stat(referencesDir)
        if (refStat.isDirectory()) referencesPath = referencesDir
      } catch {
        // ignore
      }
    }

    return {
      name,
      description,
      version,
      author,
      tags,
      source,
      body: parsed.body,
      skillMdPath: skillMd,
      referencesDir: referencesPath
    }
  }
}
