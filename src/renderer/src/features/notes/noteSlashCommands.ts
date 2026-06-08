/** 侧栏 slash 命令：注册表 + 内置命令（import 时完成注册） */
import './noteSlashCommands.builtin'

export {
  SLASH_CURSOR_MARKER,
  applySlashTemplate,
  defaultCaretSelector,
  filterSlashCommands,
  isSlashCommandAnchor,
  parseSlashAtCursor,
  resolveSlashCommand,
  slashCommandRegistry,
  trySlashCompleteOnKey,
  trySlashCompleteOnSpace,
  type NoteSlashBlockKind,
  type NoteSlashCommand,
  type SlashCursorContext
} from './noteSlashRegistry'

import { slashCommandRegistry } from './noteSlashRegistry'

/** @deprecated 请优先使用 slashCommandRegistry.all() */
export const NOTE_SLASH_COMMANDS = slashCommandRegistry.all()
