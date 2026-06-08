/** Skill 显示名（对话栏等 UI 用） */
export const SKILL_DISPLAY_NAMES: Record<string, string> = {
  'doc-summary': '文档摘要',
  'term-explain': '术语解释',
  'mindmap-generator': '思维导图'
}

export function skillDisplayName(name: string): string {
  return SKILL_DISPLAY_NAMES[name] ?? name
}
