/** 生产环境默认反馈 API 根地址；可通过环境变量 HANSTUDY_FEEDBACK_API 覆盖 */
export const DEFAULT_FEEDBACK_API_URL = 'https://wannian.fun'

export type FeedbackCategory = 'bug' | 'feature' | 'question' | 'other'

export type FeedbackStatus = 'pending' | 'triaged' | 'fixed' | 'wontfix'

/** 客户端提交载荷 */
export interface FeedbackSubmitPayload {
  category: FeedbackCategory
  title: string
  description: string
  contact?: string
  appVersion: string
  platform: string
  clientId: string
}

export interface FeedbackSubmitResult {
  ok: boolean
  id?: string
  message: string
}

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Bug / 缺陷',
  feature: '功能建议',
  question: '使用问题',
  other: '其他'
}

/** 解析反馈 API 根地址：运行时环境变量 > 构建时 .env 注入 > DEFAULT_FEEDBACK_API_URL */
export function resolveFeedbackApiUrl(envOverride?: string | null): string {
  const fromEnv = envOverride?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  return DEFAULT_FEEDBACK_API_URL
}

export function validateFeedbackPayload(
  input: Pick<FeedbackSubmitPayload, 'category' | 'title' | 'description' | 'contact'>
): string | null {
  if (!input.title.trim()) return '请填写标题'
  if (input.title.trim().length > 120) return '标题不超过 120 字'
  if (!input.description.trim()) return '请填写详细描述'
  if (input.description.trim().length > 8000) return '描述过长'
  if (input.contact?.trim() && input.contact.trim().length > 120) return '联系方式过长'
  return null
}
