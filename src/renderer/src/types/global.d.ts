import type { ElectronAPI } from '../../../preload/index'
import type { AISettings, Annotation, ChatMessage, FileEntry, TextSelectionContext } from '../../../shared/types'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export type { AISettings, Annotation, ChatMessage, FileEntry, TextSelectionContext }
export type { AnnotationTool, ChatMode } from '../../../shared/types'
