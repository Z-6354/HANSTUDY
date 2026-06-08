export const SLASH_CURSOR_MARKER = '$CURSOR$'

/** 可视化块类型，对应 data-note-block 属性值 */
export type NoteSlashBlockKind =
  | 'code'
  | 'heading'
  | 'quote'
  | 'list'
  | 'bold'
  | 'underline'
  | 'color'

/** 块级 slash 预览（Esc 需在块后插入零宽锚点，不能仅靠 setStartAfter） */
export const BLOCK_LEVEL_SLASH_KINDS = new Set<NoteSlashBlockKind>([
  'code',
  'heading',
  'quote',
  'list'
])

export function isBlockLevelSlashKind(kind: NoteSlashBlockKind | undefined): boolean {
  return kind != null && BLOCK_LEVEL_SLASH_KINDS.has(kind)
}

export function isInlineSlashKind(kind: NoteSlashBlockKind | undefined): boolean {
  return kind != null && !BLOCK_LEVEL_SLASH_KINDS.has(kind)
}

export interface NoteSlashCommand {
  id: string
  label: string
  description: string
  /** 匹配菜单/filter 的关键词（含 id） */
  keywords: string[]
  /** Markdown 源码模板（源码模式；可视化默认可回退渲染） */
  template: string
  blockKind?: NoteSlashBlockKind
  /** 可视化 WYSIWYG 片段；pad 为可编辑占位符 */
  buildVisualHtml?: (pad: string) => string
  /** 插入后光标定位 selector；缺省由 blockKind 推导 */
  caretSelector?: string
}

export interface SlashCursorContext {
  slashStart: number
  query: string
}

export class NoteSlashCommandRegistry {
  private readonly byId = new Map<string, NoteSlashCommand>()

  register(command: NoteSlashCommand): this {
    const id = command.id.trim().toLowerCase()
    if (!id) throw new Error('Slash command id is required')
    if (this.byId.has(id)) {
      throw new Error(`Slash command already registered: ${id}`)
    }
    this.byId.set(id, { ...command, id })
    return this
  }

  registerMany(commands: NoteSlashCommand[]): this {
    for (const command of commands) this.register(command)
    return this
  }

  get(id: string): NoteSlashCommand | undefined {
    return this.byId.get(id.trim().toLowerCase())
  }

  all(): NoteSlashCommand[] {
    return Array.from(this.byId.values())
  }

  filter(query: string): NoteSlashCommand[] {
    const q = query.trim().toLowerCase()
    if (!q) return this.all()
    const exact = this.get(q)
    const matched = this.all().filter((cmd) =>
      cmd.id !== q &&
      cmd.keywords.some((kw) => kw.startsWith(q) || kw.includes(q))
    )
    return exact ? [exact, ...matched] : matched
  }

  resolveById(query: string): NoteSlashCommand | null {
    return this.get(query) ?? null
  }
}

/** 全局 slash 命令注册表 */
export const slashCommandRegistry = new NoteSlashCommandRegistry()

export function defaultCaretSelector(cmd: NoteSlashCommand): string {
  if (cmd.caretSelector) return cmd.caretSelector
  switch (cmd.blockKind) {
    case 'code':
      return 'pre[data-note-block="code"] code'
    case 'heading':
      return 'h2[data-note-block="heading"]'
    case 'list':
      return 'ul[data-note-block="list"] li'
    case 'quote':
      return 'blockquote[data-note-block="quote"] p'
    case 'bold':
      return '[data-note-block="bold"]'
    case 'underline':
      return '[data-note-block="underline"]'
    case 'color':
      return '[data-note-block="color"]'
    default:
      return '[data-note-block]'
  }
}

export function isSlashCommandAnchor(before: string, slashIdx: number): boolean {
  if (slashIdx > 0 && before[slashIdx - 1] === ':') return false
  const prev = slashIdx > 0 ? before[slashIdx - 1]! : ''
  const next = before[slashIdx + 1] ?? ''
  if (/\d/.test(prev) && /\d/.test(next)) return false
  return true
}

export function parseSlashAtCursor(before: string): SlashCursorContext | null {
  const match = /\/([a-zA-Z\u4e00-\u9fff]*)$/.exec(before)
  if (!match || match.index == null) return null
  const slashStart = match.index
  if (!isSlashCommandAnchor(before, slashStart)) return null
  return { slashStart, query: match[1] ?? '' }
}

export function resolveSlashCommand(query: string): NoteSlashCommand | null {
  return slashCommandRegistry.resolveById(query)
}

export function trySlashCompleteOnKey(
  before: string
): (SlashCursorContext & { command: NoteSlashCommand }) | null {
  const ctx = parseSlashAtCursor(before)
  if (!ctx?.query) return null
  if (!isSlashCommandAnchor(before, ctx.slashStart)) return null
  const command = resolveSlashCommand(ctx.query)
  if (!command) return null
  return { ...ctx, command }
}

export function trySlashCompleteOnSpace(
  before: string
): (SlashCursorContext & { command: NoteSlashCommand }) | null {
  const match = /\/([a-zA-Z\u4e00-\u9fff]+)[ \u00a0]$/.exec(before)
  if (!match || match.index == null) return null
  const slashStart = match.index
  if (!isSlashCommandAnchor(before, slashStart)) return null
  const command = resolveSlashCommand(match[1] ?? '')
  if (!command) return null
  return { slashStart, query: match[1] ?? '', command }
}

export function filterSlashCommands(query: string): NoteSlashCommand[] {
  return slashCommandRegistry.filter(query)
}

export function applySlashTemplate(template: string): { text: string; cursorOffset: number } {
  const idx = template.indexOf(SLASH_CURSOR_MARKER)
  if (idx < 0) return { text: template, cursorOffset: template.length }
  const text = template.replace(SLASH_CURSOR_MARKER, '')
  return { text, cursorOffset: idx }
}
