import { cp, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export const BUILTIN_SKILLS_VERSION = '1.0.0'

const BUILTIN_SKILL_NAMES = ['doc-summary', 'term-explain', 'mindmap-generator'] as const

export async function extractBuiltinSkills(sourceRoot: string, cacheRoot: string): Promise<void> {
  if (!existsSync(sourceRoot)) {
    console.warn('[skills] 内置 skill 源目录不存在:', sourceRoot)
    return
  }

  await mkdir(cacheRoot, { recursive: true })
  const versionFile = join(cacheRoot, '.version')

  if (existsSync(versionFile)) {
    try {
      const existing = (await readFile(versionFile, 'utf-8')).trim()
      if (existing === BUILTIN_SKILLS_VERSION) return
    } catch {
      // rebuild
    }
  }

  for (const name of BUILTIN_SKILL_NAMES) {
    const srcDir = join(sourceRoot, name)
    const destDir = join(cacheRoot, name)
    if (!existsSync(srcDir)) {
      console.warn('[skills] 内置 skill 缺失:', srcDir)
      continue
    }
    if (existsSync(destDir)) {
      await rm(destDir, { recursive: true, force: true })
    }
    await cp(srcDir, destDir, { recursive: true })
  }

  await writeFile(versionFile, BUILTIN_SKILLS_VERSION, 'utf-8')
}

export async function installSkillFromDirectory(sourceDir: string, userSkillsDir: string): Promise<string> {
  const skillMd = join(sourceDir, 'SKILL.md')
  if (!existsSync(skillMd)) {
    throw new Error('所选文件夹缺少 SKILL.md')
  }

  const content = await readFile(skillMd, 'utf-8')
  const folderName = sourceDir.split(/[/\\]/).pop() ?? 'custom-skill'
  let targetName = folderName

  const nameMatch = content.match(/^---\s*\n[\s\S]*?\nname:\s*([^\n]+)\n[\s\S]*?\n---/m)
  if (nameMatch?.[1]) {
    targetName = nameMatch[1].trim().replace(/^["']|["']$/g, '')
  }

  if (!targetName) {
    throw new Error('无法确定 skill 名称')
  }

  await mkdir(userSkillsDir, { recursive: true })
  const targetDir = join(userSkillsDir, targetName)
  if (existsSync(targetDir)) {
    await rm(targetDir, { recursive: true, force: true })
  }
  await cp(sourceDir, targetDir, { recursive: true })
  return targetName
}

export async function listBuiltinSkillNames(sourceRoot: string): Promise<string[]> {
  if (!existsSync(sourceRoot)) return []
  const entries = await readdir(sourceRoot, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}
