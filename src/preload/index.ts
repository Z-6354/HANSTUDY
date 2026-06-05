import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { AISettings, Annotation, TextSelectionContext } from '../shared/types'

export interface OpenedFileInfo {
  path: string
  name: string
  type: 'txt' | 'md' | 'pdf' | 'docx' | 'unknown'
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface FolderOpenResult {
  path: string
  files: FileEntry[]
}

export type { Annotation, AISettings, TextSelectionContext }

const api = {
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized')
  },
  dialog: {
    openFile: (): Promise<OpenedFileInfo | null> => ipcRenderer.invoke('dialog:openFile'),
    openFolder: (): Promise<FolderOpenResult | null> => ipcRenderer.invoke('dialog:openFolder'),
    importFiles: (
      targetDir: string
    ): Promise<{
      imported: Array<{ path: string; name: string; error?: string }>
      canceled: boolean
    }> => ipcRenderer.invoke('dialog:importFiles', targetDir),
    saveMarkdown: (content: string, defaultName: string): Promise<boolean> =>
      ipcRenderer.invoke('dialog:saveMarkdown', content, defaultName)
  },
  fs: {
    listDirectory: (dirPath: string): Promise<FileEntry[]> =>
      ipcRenderer.invoke('fs:listDirectory', dirPath),
    readText: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:readText', filePath),
    readBinary: (filePath: string): Promise<number[]> =>
      ipcRenderer.invoke('fs:readBinary', filePath),
    getFileInfo: (filePath: string): Promise<OpenedFileInfo & { supported: boolean }> =>
      ipcRenderer.invoke('fs:getFileInfo', filePath),
    getDocumentContext: (
      filePath: string
    ): Promise<{ fileName: string; content: string; truncated: boolean }> =>
      ipcRenderer.invoke('fs:getDocumentContext', filePath),
    createFile: (
      dirPath: string,
      fileName: string
    ): Promise<OpenedFileInfo> => ipcRenderer.invoke('fs:createFile', dirPath, fileName),
    createFolder: (
      dirPath: string,
      folderName: string
    ): Promise<FileEntry> => ipcRenderer.invoke('fs:createFolder', dirPath, folderName),
    delete: (targetPath: string): Promise<boolean> =>
      ipcRenderer.invoke('fs:delete', targetPath),
    rename: (
      targetPath: string,
      newName: string
    ): Promise<OpenedFileInfo & { supported: boolean }> =>
      ipcRenderer.invoke('fs:rename', targetPath, newName)
  },
  annotations: {
    list: (docPath: string): Promise<Annotation[]> =>
      ipcRenderer.invoke('annotations:list', docPath),
    create: (input: Omit<Annotation, 'id' | 'createdAt'>): Promise<Annotation> =>
      ipcRenderer.invoke('annotations:create', input),
    update: (id: string, patch: Partial<Annotation>): Promise<Annotation | null> =>
      ipcRenderer.invoke('annotations:update', id, patch),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('annotations:delete', id),
    exportMarkdown: (docPath: string): Promise<string> =>
      ipcRenderer.invoke('annotations:export', docPath)
  },
  settings: {
    get: (): Promise<AISettings> => ipcRenderer.invoke('settings:get'),
    getRaw: (): Promise<AISettings> => ipcRenderer.invoke('settings:getRaw'),
    save: (settings: AISettings): Promise<boolean> => ipcRenderer.invoke('settings:save', settings)
  },
  ai: {
    chat: (
      requestId: string,
      messages: Array<{ role: string; content: string }>,
      contextText?: string,
      documentContext?: { fileName: string; content: string },
      chatMode?: 'agent' | 'chat' | 'reading'
    ): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('ai:chat', requestId, messages, contextText, documentContext, chatMode),
    abort: (requestId: string): Promise<void> => ipcRenderer.invoke('ai:abort', requestId),
    onStreamChunk: (cb: (requestId: string, chunk: string) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, requestId: string, chunk: string): void =>
        cb(requestId, chunk)
      ipcRenderer.on('ai:stream-chunk', handler)
      return () => ipcRenderer.removeListener('ai:stream-chunk', handler)
    },
    onStreamDone: (cb: (requestId: string, full: string) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, requestId: string, full: string): void =>
        cb(requestId, full)
      ipcRenderer.on('ai:stream-done', handler)
      return () => ipcRenderer.removeListener('ai:stream-done', handler)
    },
    onStreamError: (cb: (requestId: string, error: string) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, requestId: string, error: string): void =>
        cb(requestId, error)
      ipcRenderer.on('ai:stream-error', handler)
      return () => ipcRenderer.removeListener('ai:stream-error', handler)
    },
    onStreamAborted: (cb: (requestId: string) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, requestId: string): void => cb(requestId)
      ipcRenderer.on('ai:stream-aborted', handler)
      return () => ipcRenderer.removeListener('ai:stream-aborted', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
