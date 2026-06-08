import type { Notebook } from './notebooks'

export const NOTEBOOK_EXPORT_VERSION = 1 as const

export interface NotebookExportFile {
  version: typeof NOTEBOOK_EXPORT_VERSION
  exportedAt: string
  notebook: Notebook
}

export function serializeNotebookExport(notebook: Notebook): string {
  const payload: NotebookExportFile = {
    version: NOTEBOOK_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    notebook
  }
  return JSON.stringify(payload, null, 2)
}

export function parseNotebookExport(raw: string): Notebook {
  const parsed = JSON.parse(raw) as NotebookExportFile | Notebook
  const notebook = 'notebook' in parsed && parsed.notebook ? parsed.notebook : (parsed as Notebook)
  if (!notebook?.id || !Array.isArray(notebook.entries)) {
    throw new Error('无效的笔记本导出文件')
  }
  return notebook
}
