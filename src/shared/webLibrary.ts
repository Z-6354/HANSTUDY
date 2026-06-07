export interface WebHistoryEntry {
  id: string
  url: string
  title: string
  visitedAt: string
}

export interface WebBookmark {
  id: string
  url: string
  title: string
  createdAt: string
}

/** 持久化结构（密码字段已加密） */
export interface WebCredentialRecord {
  id: string
  origin: string
  username: string
  passwordEnc: string
  label?: string
  updatedAt: string
}

/** 渲染进程列表展示（不含密码） */
export interface WebCredentialItem {
  id: string
  origin: string
  username: string
  label?: string
  updatedAt: string
}

export interface SaveWebCredentialInput {
  id?: string
  origin: string
  username: string
  password: string
  label?: string
}

export const WEB_HISTORY_MAX = 500
export const WEB_PHONE_MAX = 50

export interface WebPhoneEntry {
  id: string
  /** 纯数字，中国大陆手机号为 11 位 */
  phone: string
  label?: string
  origin?: string
  updatedAt: string
}

export function webPageOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

export function isRecordableWebUrl(url: string): boolean {
  if (!url?.trim() || url === 'about:blank') return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** 是否为真实页面标题（非 URL、非域名占位） */
export function isUsableWebPageTitle(title: string | undefined | null, url: string): boolean {
  const trimmed = title?.trim()
  if (!trimmed) return false
  if (trimmed === url.trim()) return false
  if (/^https?:\/\//i.test(trimmed)) return false
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return false
  } catch {
    /* 非 URL 字符串 */
  }
  return true
}

/** 写入历史/收藏时解析标题，保留已有有效标题 */
export function resolveWebPageTitle(
  title: string,
  url: string,
  previousTitle?: string
): string {
  if (isUsableWebPageTitle(title, url)) return title.trim()
  if (isUsableWebPageTitle(previousTitle, url)) return previousTitle!.trim()
  return ''
}

/** 侧栏/标签展示：仅显示页面标题，无标题时用「网页」 */
export function webDisplayTitle(title: string, url: string): string {
  if (isUsableWebPageTitle(title, url)) return title.trim()
  return '网页'
}

/** 从用户输入提取并规范化手机号（优先中国大陆 11 位） */
export function normalizePhoneNumber(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const digits = trimmed.replace(/\D/g, '')
  if (/^1\d{10}$/.test(digits)) return digits
  const cnMatch = /^86(1\d{10})$/.exec(digits)
  if (cnMatch) return cnMatch[1]
  if (/^\d{7,15}$/.test(digits)) return digits
  return null
}

export function formatPhoneDisplay(phone: string): string {
  if (/^1\d{10}$/.test(phone)) {
    return `${phone.slice(0, 3)} ${phone.slice(3, 7)} ${phone.slice(7)}`
  }
  return phone
}

/** 判断已存站点 origin 是否与当前页匹配（含子域） */
export function credentialsOriginMatch(savedOrigin: string, pageOrigin: string): boolean {
  const saved = webPageOrigin(savedOrigin) || savedOrigin.trim()
  const current = webPageOrigin(pageOrigin) || pageOrigin.trim()
  if (!saved || !current) return false
  if (saved === current) return true
  try {
    const savedHost = new URL(saved).hostname
    const currentHost = new URL(current).hostname
    return (
      savedHost === currentHost ||
      currentHost.endsWith(`.${savedHost}`) ||
      savedHost.endsWith(`.${currentHost}`)
    )
  } catch {
    return false
  }
}
