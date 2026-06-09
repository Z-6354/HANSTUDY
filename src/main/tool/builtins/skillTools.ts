import type { ToolRegistry } from '../ToolRegistry'
import { BUILTIN_TOOLS } from '../../../shared/agent/tools'
import {
  getSkillRegistry,
  loadSkillBody,
  pushSkillToActiveContext
} from '../../skill/skillService'
import { MAX_SKILL_BODY_BYTES, truncateSkillBodyBytes } from '../../skill/skillIndexFormatter'
import { createToolParameters } from './schemaHelpers'

export function registerSkillTools(registry: ToolRegistry): void {
  registry.register({
    name: BUILTIN_TOOLS.loadSkill,
    description:
      '加载 system prompt「可用 Skills」索引中列出的 skill 完整 SKILL.md 指引。' +
      '当任务匹配某 skill 描述时调用，传入精确的 kebab-case 名称。' +
      '正文将在下一轮以 "## 已加载 Skill：<name>" 段出现；勿重复加载同一 skill。',
    parameters: createToolParameters([
      { name: 'name', type: 'string', description: 'skill 名称，如 doc-summary', required: true }
    ]),
    handler: async (args) => {
      const name = String(args.name ?? '').trim()
      if (!name) {
        return { success: false, content: '', error: 'load_skill 失败: name 不能为空' }
      }

      const skillRegistry = getSkillRegistry()
      if (!skillRegistry) {
        return { success: false, content: '', error: 'load_skill 失败: Skill 系统未初始化' }
      }

      const anySkill = skillRegistry.findAnySkill(name)
      if (!anySkill) {
        return { success: false, content: '', error: `Skill '${name}' 未找到` }
      }

      const enabledSkill = await skillRegistry.findSkill(name)
      if (!enabledSkill) {
        return {
          success: false,
          content: '',
          error: `Skill '${name}' 已被禁用，请在设置中启用`
        }
      }

      const originalLen = enabledSkill.body.length
      const injected = truncateSkillBodyBytes(enabledSkill.body.trim(), MAX_SKILL_BODY_BYTES)
      const pushed = await pushSkillToActiveContext(name, injected)

      if (pushed) {
        return {
          success: true,
          content:
            `已加载 skill '${name}' 的完整指引（${originalLen} 字符），` +
            `将在下一轮上下文中以 "## 已加载 Skill：${name}" 段出现。`
        }
      }

      // 非 Agent 上下文（测试或直连调用）时回退为直接返回正文
      const body = await loadSkillBody(name)
      if (!body) {
        return { success: false, content: '', error: `Skill 不存在或未启用: ${name}` }
      }
      return { success: true, content: body }
    }
  })
}
