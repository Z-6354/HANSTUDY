import type { ElectronAPI } from '../../../preload/index'
import type { SkillListItem } from '@shared/skills'
import type { NoteEntry } from '@shared/notes'
import type { AISettings, ChatMessage, FileEntry, TextSelectionContext, WorkbenchMode } from '@shared/types'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export type {
  AISettings,
  ChatMessage,
  ChatMode,
  FileEntry,
  NoteEntry,
  TextSelectionContext,
  WorkbenchMode,
  SkillListItem
}
