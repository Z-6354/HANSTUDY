import type { ToolRegistry } from '../ToolRegistry'
import { registerDocumentTools } from './documentTools'
import { registerLibraryTools } from './libraryTools'
import { registerNotesTools } from './notesTools'
import { registerSkillTools } from './skillTools'

/**
 * 注册全部内置工具（对齐 hancli ToolRegistry 构造函数中的 registerFileTools 等分组调用）。
 */
export function registerAllBuiltinTools(registry: ToolRegistry): void {
  registerDocumentTools(registry)
  registerLibraryTools(registry)
  registerNotesTools(registry)
  registerSkillTools(registry)
}

/** @deprecated 使用 registerAllBuiltinTools 或 ToolRegistry.registerBuiltins */
export const registerBuiltinTools = registerAllBuiltinTools
