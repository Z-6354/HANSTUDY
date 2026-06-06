import type { ElectronAPI } from '../../../preload/index'
import type { SkillListItem } from '@shared/skills'
import type { WebSnapshotMeta } from '@shared/webSnapshot'
import type { AISettings, Annotation, ChatMessage, FileEntry, TextSelectionContext } from '@shared/types'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export type {
  AISettings,
  Annotation,
  AnnotationTool,
  ChatMessage,
  ChatMode,
  DrawShape,
  FileEntry,
  ShapePoint,
  TextRange,
  TextSelectionContext,
  SkillListItem
}
export type { WebSnapshotMeta } from '@shared/webSnapshot'
