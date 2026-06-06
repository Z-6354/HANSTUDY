export type SkillSource = 'builtin' | 'user' | 'project'

export interface Skill {
  name: string
  description: string
  version?: string
  author?: string
  tags: string[]
  source: SkillSource
  body: string
  skillMdPath: string
  referencesDir?: string
}

export interface SkillListItem {
  name: string
  description: string
  version?: string
  author?: string
  tags: string[]
  source: SkillSource
  skillMdPath: string
  enabled: boolean
}

export interface SkillState {
  disabled: string[]
}

export interface SkillChatMeta {
  activeSkills: Array<{ name: string; description: string }>
}
