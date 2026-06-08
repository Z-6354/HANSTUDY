import type { NoteSortMode } from './documentNotes'

export type { DocumentNoteAnchor, DocumentNoteEntry, NoteSortMode } from './documentNotes'

/** 系统默认笔记本，不可删除 */
export const DEFAULT_NOTEBOOK_ID = 'notebook-default'

/** 笔记本元数据（索引项，不含条目） */
export interface NotebookMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  defaultSortMode: NoteSortMode
}

/** 完整笔记本：条目与关联文档均由笔记本侧维护，与文档实体解耦 */
export interface Notebook {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  defaultSortMode: NoteSortMode
  /** 曾在此笔记本下记过笔记的文档路径（多对多关联索引） */
  linkedDocPaths: string[]
  entries: import('./documentNotes').DocumentNoteEntry[]
}

export interface NotebooksIndex {
  version: 1
  notebooks: NotebookMeta[]
  updatedAt: string
}

export interface CreateNotebookInput {
  name: string
  defaultSortMode?: NoteSortMode
}

export interface RenameNotebookInput {
  id: string
  name: string
}
