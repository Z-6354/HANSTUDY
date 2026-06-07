/** 笔记库 — 独立于文档标注，存于 userData/notes/ */

export interface NoteEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface NoteMeta {
  path: string
  title: string
  updatedAt: string
}
