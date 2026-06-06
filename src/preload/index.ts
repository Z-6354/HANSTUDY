import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { AppSettings } from '../shared/appSettings'
import type { AISettings, Annotation, TextSelectionContext } from '../shared/types'
import type { WebDiagnosticProbeResult, WebDiagnosticReport } from '../shared/webDiagnostics'
import type { SaveWebSnapshotInput, WebSnapshotMeta } from '../shared/webSnapshot'
import type {
  SaveWebCredentialInput,
  WebBookmark,
  WebCredentialItem,
  WebHistoryEntry,
  WebPhoneEntry
} from '../shared/webLibrary'
import type { WebGuestBounds, WebGuestEvent } from '../shared/webGuest'
import type { SkillListItem } from '../shared/skills'

export interface OpenedFileInfo {
  path: string
  name: string
  type: 'txt' | 'md' | 'pdf' | 'docx' | 'web-snapshot' | 'web' | 'unknown'
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

export type { Annotation, AISettings, TextSelectionContext, SkillListItem, WebSnapshotMeta }

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
  appSettings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('appSettings:get'),
    save: (settings: AppSettings): Promise<boolean> =>
      ipcRenderer.invoke('appSettings:save', settings)
  },
  web: {
    openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('web:openExternal', url),
    saveSnapshot: (input: SaveWebSnapshotInput): Promise<WebSnapshotMeta> =>
      ipcRenderer.invoke('web:saveSnapshot', input),
    listSnapshots: (): Promise<WebSnapshotMeta[]> => ipcRenderer.invoke('web:listSnapshots'),
    getSnapshotMeta: (pdfPath: string): Promise<WebSnapshotMeta | null> =>
      ipcRenderer.invoke('web:getSnapshotMeta', pdfPath),
    deleteSnapshot: (id: string): Promise<boolean> => ipcRenderer.invoke('web:deleteSnapshot', id),
    runDiagnostics: (): Promise<WebDiagnosticReport> => ipcRenderer.invoke('web:runDiagnostics'),
    probeUrl: (url: string): Promise<WebDiagnosticProbeResult> =>
      ipcRenderer.invoke('web:probeUrl', url)
  },
  webLibrary: {
    listHistory: (): Promise<WebHistoryEntry[]> => ipcRenderer.invoke('webLibrary:listHistory'),
    addHistory: (url: string, title: string): Promise<WebHistoryEntry[]> =>
      ipcRenderer.invoke('webLibrary:addHistory', url, title),
    removeHistory: (id: string): Promise<WebHistoryEntry[]> =>
      ipcRenderer.invoke('webLibrary:removeHistory', id),
    clearHistory: (): Promise<WebHistoryEntry[]> => ipcRenderer.invoke('webLibrary:clearHistory'),
    listBookmarks: (): Promise<WebBookmark[]> => ipcRenderer.invoke('webLibrary:listBookmarks'),
    addBookmark: (url: string, title: string): Promise<WebBookmark[]> =>
      ipcRenderer.invoke('webLibrary:addBookmark', url, title),
    removeBookmark: (id: string): Promise<WebBookmark[]> =>
      ipcRenderer.invoke('webLibrary:removeBookmark', id),
    isBookmarked: (url: string): Promise<boolean> => ipcRenderer.invoke('webLibrary:isBookmarked', url),
    listCredentials: (): Promise<WebCredentialItem[]> =>
      ipcRenderer.invoke('webLibrary:listCredentials'),
    saveCredential: (input: SaveWebCredentialInput): Promise<WebCredentialItem[]> =>
      ipcRenderer.invoke('webLibrary:saveCredential', input),
    removeCredential: (id: string): Promise<WebCredentialItem[]> =>
      ipcRenderer.invoke('webLibrary:removeCredential', id),
    getCredentialPassword: (id: string): Promise<string> =>
      ipcRenderer.invoke('webLibrary:getCredentialPassword', id),
    listPhones: (): Promise<WebPhoneEntry[]> => ipcRenderer.invoke('webLibrary:listPhones'),
    addPhone: (phone: string, origin?: string): Promise<WebPhoneEntry[]> =>
      ipcRenderer.invoke('webLibrary:addPhone', phone, origin),
    removePhone: (id: string): Promise<WebPhoneEntry[]> =>
      ipcRenderer.invoke('webLibrary:removePhone', id),
    onPhonesChanged: (callback: (phones: WebPhoneEntry[]) => void): (() => void) => {
      const handler = (_: IpcRendererEvent, phones: WebPhoneEntry[]): void => callback(phones)
      ipcRenderer.on('webLibrary:phonesChanged', handler)
      return () => ipcRenderer.removeListener('webLibrary:phonesChanged', handler)
    }
  },
  webGuest: {
    attach: (
      docId: string,
      bounds: WebGuestBounds
    ): Promise<{ ok: boolean; url: string; canGoBack: boolean; canGoForward: boolean }> =>
      ipcRenderer.invoke('webGuest:attach', docId, bounds),
    detach: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('webGuest:detach'),
    destroy: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('webGuest:destroy'),
    destroyDoc: (docId: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('webGuest:destroyDoc', docId),
    setBounds: (bounds: WebGuestBounds): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('webGuest:setBounds', bounds),
    navigate: (docId: string, url: string): Promise<{ ok: boolean; url: string; started: boolean }> =>
      ipcRenderer.invoke('webGuest:navigate', docId, url),
    back: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('webGuest:back'),
    forward: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('webGuest:forward'),
    reload: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('webGuest:reload'),
    getState: (): Promise<{ url: string; canGoBack: boolean; canGoForward: boolean }> =>
      ipcRenderer.invoke('webGuest:getState'),
    openDevTools: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('webGuest:openDevTools'),
    onEvent: (callback: (event: WebGuestEvent) => void): (() => void) => {
      const handler = (_: IpcRendererEvent, payload: WebGuestEvent): void => callback(payload)
      ipcRenderer.on('webGuest:event', handler)
      return () => ipcRenderer.removeListener('webGuest:event', handler)
    }
  },
  backend: {
    getStatus: (): Promise<{
      jarAvailable: boolean
      javaRunning: boolean
      storageMode: 'java' | 'node'
      fallbackReason?: string
    }> => ipcRenderer.invoke('backend:getStatus')
  },
  skills: {
    list: (): Promise<SkillListItem[]> => ipcRenderer.invoke('skills:list'),
    enable: (name: string): Promise<boolean> => ipcRenderer.invoke('skills:enable', name),
    disable: (name: string): Promise<boolean> => ipcRenderer.invoke('skills:disable', name),
    reload: (): Promise<SkillListItem[]> => ipcRenderer.invoke('skills:reload'),
    install: (): Promise<{ name: string; skills: SkillListItem[] } | null> =>
      ipcRenderer.invoke('skills:install'),
    openDir: (): Promise<string> => ipcRenderer.invoke('skills:openDir'),
    setProjectDir: (rootFolder: string | null): Promise<SkillListItem[]> =>
      ipcRenderer.invoke('skills:setProjectDir', rootFolder)
  },
  ai: {
    chat: (
      requestId: string,
      messages: Array<{ role: string; content: string }>,
      contextText?: string,
      documentContext?: { fileName: string; content: string },
      chatMode?: 'agent' | 'chat' | 'reading',
      excludedSkills?: string[]
    ): Promise<{ ok: boolean; error?: string; activeSkills?: Array<{ name: string; description: string }> }> =>
      ipcRenderer.invoke(
        'ai:chat',
        requestId,
        messages,
        contextText,
        documentContext,
        chatMode,
        excludedSkills
      ),
    abort: (requestId: string): Promise<void> => ipcRenderer.invoke('ai:abort', requestId),
    onStreamChunk: (cb: (requestId: string, chunk: string) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, requestId: string, chunk: string): void =>
        cb(requestId, chunk)
      ipcRenderer.on('ai:stream-chunk', handler)
      return () => ipcRenderer.removeListener('ai:stream-chunk', handler)
    },
    onStreamDone: (
      cb: (
        requestId: string,
        full: string,
        activeSkills?: Array<{ name: string; description: string }>
      ) => void
    ): (() => void) => {
      const handler = (
        _e: IpcRendererEvent,
        requestId: string,
        full: string,
        activeSkills?: Array<{ name: string; description: string }>
      ): void => cb(requestId, full, activeSkills)
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
