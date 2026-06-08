export interface NoteSlashCommand {
  id: string
  label: string
  description: string
  /** 触发词（含完整 id），如 daima */
  keywords: string[]
  /** 插入模板；$CURSOR$ 为光标占位 */
  template: string
}

export const NOTE_SLASH_COMMANDS: NoteSlashCommand[] = [
  {
    id: 'daima',
    label: '/daima',
    description: '代码块',
    keywords: ['daima', 'daimai', 'dm', 'dai', 'code'],
    template: '```\n$CURSOR$\n```'
  },
  {
    id: 'biaoti',
    label: '/biaoti',
    description: '二级标题',
    keywords: ['biaoti', 'bt', 'h2', 'title'],
    template: '## $CURSOR$'
  },
  {
    id: 'liebiao',
    label: '/liebiao',
    description: '无序列表',
    keywords: ['liebiao', 'lb', 'list', 'ul'],
    template: '- $CURSOR$'
  },
  {
    id: 'yinyong',
    label: '/yinyong',
    description: '引用块',
    keywords: ['yinyong', 'yy', 'quote'],
    template: '> $CURSOR$'
  },
  {
    id: 'jialuo',
    label: '/jialuo',
    description: '加粗',
    keywords: ['jialuo', 'jl', 'bold'],
    template: '**$CURSOR$**'
  },
  {
    id: 'xiahuaxian',
    label: '/xiahuaxian',
    description: '下划线',
    keywords: ['xiahuaxian', 'xhx', 'underline', 'u'],
    template: '<u>$CURSOR$</u>'
  }
]

export interface SlashCursorContext {
  slashStart: number
  query: string
}

/** 判断 `/` 是否为块命令触发点（排除 URL、纯数字分数等） */
export function isSlashCommandAnchor(before: string, slashIdx: number): boolean {
  if (slashIdx > 0 && before[slashIdx - 1] === ':') return false
  const prev = slashIdx > 0 ? before[slashIdx - 1]! : ''
  const next = before[slashIdx + 1] ?? ''
  if (/\d/.test(prev) && /\d/.test(next)) return false
  return true
}

/** 解析光标前正在输入的 `/命令`（可在句中，不必行首） */
export function parseSlashAtCursor(before: string): SlashCursorContext | null {
  const match = /\/([a-zA-Z\u4e00-\u9fff]*)$/.exec(before)
  if (!match || match.index == null) return null
  const slashStart = match.index
  if (!isSlashCommandAnchor(before, slashStart)) return null
  return { slashStart, query: match[1] ?? '' }
}

/** 空格自动应用：仅当 query 与某条命令 id 完全一致（与菜单项 id 相同，非前缀/别名） */
export function resolveSlashCommand(query: string): NoteSlashCommand | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  return NOTE_SLASH_COMMANDS.find((cmd) => cmd.id === q) ?? null
}

/** `/命令id `：完整 id + 尾随空格 → 自动应用对应模板（可在句中任意位置） */
export function trySlashCompleteOnSpace(
  before: string
): (SlashCursorContext & { command: NoteSlashCommand }) | null {
  const match = /\/([a-zA-Z\u4e00-\u9fff]+) $/.exec(before)
  if (!match || match.index == null) return null
  const slashStart = match.index
  if (!isSlashCommandAnchor(before, slashStart)) return null
  const command = resolveSlashCommand(match[1] ?? '')
  if (!command) return null
  return { slashStart, query: match[1] ?? '', command }
}

export function filterSlashCommands(query: string): NoteSlashCommand[] {
  const q = query.trim().toLowerCase()
  if (!q) return NOTE_SLASH_COMMANDS
  return NOTE_SLASH_COMMANDS.filter((cmd) =>
    cmd.keywords.some((kw) => kw.startsWith(q) || kw.includes(q))
  )
}

export function applySlashTemplate(template: string): { text: string; cursorOffset: number } {
  const marker = '$CURSOR$'
  const idx = template.indexOf(marker)
  if (idx < 0) return { text: template, cursorOffset: template.length }
  const text = template.replace(marker, '')
  return { text, cursorOffset: idx }
}
