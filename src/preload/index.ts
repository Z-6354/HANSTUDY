import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { AppSettings } from '../shared/appSettings'
import type { AISettings, TextSelectionContext } from '../shared/types'
import type { WebDiagnosticProbeResult, WebDiagnosticReport } from '../shared/webDiagnostics'
import type { SaveWebCredentialInput, WebBookmark, WebCredentialItem, WebHistoryEntry, WebPhoneEntry } from '../shared/webLibrary'
import type { WebGuestBounds, WebGuestEvent } from '../shared/webGuest'
import type { McpServerState } from '../shared/mcp/types'
import type { SkillListItem } from '../shared/skills'
import { IPC } from '../shared/ipc/channels'

export interface OpenedFileInfo {
  path: string
  name: string
  type: 'txt' | 'md' | 'pdf' | 'docx' | 'web' | 'unknown'
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

export type { AISettings, TextSelectionContext, SkillListItem }

const api = {
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    resetPageZoom: (): Promise<void> => ipcRenderer.invoke(IPC.window.resetPageZoom),
    onMaximizedChanged: (cb: (maximized: boolean) => void): (() => void) => {
      const handler = (_e: IpcRendererEvent, maximized: boolean): void => cb(maximized)
      ipcRenderer.on('window:maximized-changed', handler)
      return () => ipcRenderer.removeListener('window:maximized-changed', handler)
    }
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
      ipcRenderer.invoke('dialog:saveMarkdown', content, defaultName),
    saveJson: (content: string, defaultName: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.dialog.saveJson, content, defaultName),
    openJson: (): Promise<{ path: string; content: string } | null> =>
      ipcRenderer.invoke(IPC.dialog.openJson)
  },
  localLibrary: {
    list: (): Promise<FileEntry[]> => ipcRenderer.invoke('localLibrary:list'),
    getPath: (): Promise<string> => ipcRenderer.invoke('localLibrary:getPath'),
    import: (): Promise<{
      imported: Array<{ path: string; name: string; error?: string }>
      canceled: boolean
    }> => ipcRenderer.invoke('localLibrary:import')
  },
  fs: {
    listDirectory: (dirPath: string): Promise<FileEntry[]> =>
      ipcRenderer.invoke('fs:listDirectory', dirPath),
    readText: (
      filePath: string
    ): Promise<{ content: string; sizeBytes: number }> => ipcRenderer.invoke('fs:readText', filePath),
    writeText: (filePath: string, content: string): Promise<boolean> =>
      ipcRenderer.invoke('fs:writeText', filePath, content),
    readBinary: (filePath: string): Promise<Uint8Array> =>
      ipcRenderer.invoke('fs:readBinary', filePath),
    getFileInfo: (filePath: string): Promise<OpenedFileInfo & { supported: boolean }> =>
      ipcRenderer.invoke('fs:getFileInfo', filePath),
    getDocumentContext: (
      filePath: string
    ): Promise<{ fileName: string; content: string; truncated: boolean }> =>
      ipcRenderer.invoke('fs:getDocumentContext', filePath),
    getAiChatDocumentContext: (
      filePath: string,
      options?: { monacoLine?: number; scrollRatio?: number }
    ): Promise<{
      fileName: string
      content: string
      truncated: boolean
      sectionTitle?: string
    }> => ipcRenderer.invoke(IPC.fs.getAiChatDocumentContext, filePath, options ?? {}),
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
  notes: {
    getRoot: (): Promise<string> => ipcRenderer.invoke(IPC.notes.getRoot),
    list: (dirPath?: string): Promise<FileEntry[]> =>
      ipcRenderer.invoke(IPC.notes.list, dirPath),
    read: (filePath: string): Promise<string> => ipcRenderer.invoke(IPC.notes.read, filePath),
    write: (filePath: string, content: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.notes.write, filePath, content),
    append: (filePath: string, chunk: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.notes.append, filePath, chunk),
    createFile: (dirPath: string, fileName: string): Promise<string> =>
      ipcRenderer.invoke(IPC.notes.createFile, dirPath, fileName),
    createFolder: (dirPath: string, folderName: string): Promise<string> =>
      ipcRenderer.invoke(IPC.notes.createFolder, dirPath, folderName),
    delete: (targetPath: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.notes.delete, targetPath),
    rename: (targetPath: string, newName: string): Promise<string> =>
      ipcRenderer.invoke(IPC.notes.rename, targetPath, newName)
  },
  documentNotes: {
    get: (
      docPath: string
    ): Promise<import('../shared/documentNotes').DocumentNoteThread | null> =>
      ipcRenderer.invoke(IPC.documentNotes.get, docPath),
    save: (thread: import('../shared/documentNotes').DocumentNoteThread): Promise<boolean> =>
      ipcRenderer.invoke(IPC.documentNotes.save, thread)
  },
  notebooks: {
    list: (): Promise<import('../shared/notebooks').NotebooksIndex> =>
      ipcRenderer.invoke(IPC.notebooks.list),
    get: (id: string): Promise<import('../shared/notebooks').Notebook | null> =>
      ipcRenderer.invoke(IPC.notebooks.get, id),
    save: (notebook: import('../shared/notebooks').Notebook): Promise<boolean> =>
      ipcRenderer.invoke(IPC.notebooks.save, notebook),
    create: (
      input: import('../shared/notebooks').CreateNotebookInput
    ): Promise<import('../shared/notebooks').Notebook> =>
      ipcRenderer.invoke(IPC.notebooks.create, input),
    rename: (
      input: import('../shared/notebooks').RenameNotebookInput
    ): Promise<import('../shared/notebooks').Notebook> =>
      ipcRenderer.invoke(IPC.notebooks.rename, input),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.notebooks.delete, id),
    linkDoc: (
      notebookId: string,
      docPath: string
    ): Promise<import('../shared/notebooks').Notebook> =>
      ipcRenderer.invoke(IPC.notebooks.linkDoc, notebookId, docPath),
    importLegacy: (
      notebookId: string,
      docPath: string
    ): Promise<import('../shared/notebooks').Notebook | null> =>
      ipcRenderer.invoke(IPC.notebooks.importLegacy, notebookId, docPath),
    importNotebook: (
      notebook: import('../shared/notebooks').Notebook
    ): Promise<import('../shared/notebooks').Notebook> =>
      ipcRenderer.invoke(IPC.notebooks.importNotebook, notebook)
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
    listCredentialsForOrigin: (origin: string): Promise<WebCredentialItem[]> =>
      ipcRenderer.invoke('webLibrary:listCredentialsForOrigin', origin),
    onCredentialsChanged: (callback: (credentials: WebCredentialItem[]) => void): (() => void) => {
      const handler = (_: IpcRendererEvent, credentials: WebCredentialItem[]): void =>
        callback(credentials)
      ipcRenderer.on('webLibrary:credentialsChanged', handler)
      return () => ipcRenderer.removeListener('webLibrary:credentialsChanged', handler)
    },
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
    prepareDoc: (docId: string, url?: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('webGuest:prepareDoc', docId, url),
    attach: (
      docId: string,
      bounds: WebGuestBounds,
      url?: string
    ): Promise<{
      ok: boolean
      url: string
      started: boolean
      canGoBack: boolean
      canGoForward: boolean
    }> => ipcRenderer.invoke('webGuest:attach', docId, bounds, url),
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
    selectAll: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('webGuest:selectAll'),
    findInPage: (text: string, forward?: boolean): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('webGuest:findInPage', text, forward ?? true),
    stopFindInPage: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('webGuest:stopFindInPage'),
    getState: (): Promise<{
      url: string
      attached: boolean
      canGoBack: boolean
      canGoForward: boolean
    }> => ipcRenderer.invoke('webGuest:getState'),
    openDevTools: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('webGuest:openDevTools'),
    onEvent: (callback: (event: WebGuestEvent) => void): (() => void) => {
      const handler = (_: IpcRendererEvent, payload: WebGuestEvent): void => callback(payload)
      ipcRenderer.on(IPC.webGuest.event, handler)
      return () => ipcRenderer.removeListener(IPC.webGuest.event, handler)
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
  system: {
    getMemory: (): Promise<{
      main: {
        rssMb: number
        heapUsedMb: number
        heapTotalMb: number
        externalMb: number
        arrayBuffersMb: number
      }
      renderer: {
        rssMb: number
        heapUsedMb: number
        heapTotalMb: number
        externalMb: number
        arrayBuffersMb: number
      } | null
      openWebGuestCount: number
      timestamp: string
    }> => ipcRenderer.invoke('system:getMemory')
  },
  readingProgress: {
    get: (docPath: string): Promise<import('../shared/readingProgress').ReadingProgress | null> =>
      ipcRenderer.invoke('readingProgress:get', docPath),
    save: (
      progress: Partial<import('../shared/readingProgress').ReadingProgress> & { docPath: string }
    ): Promise<import('../shared/readingProgress').ReadingProgress> =>
      ipcRenderer.invoke('readingProgress:save', progress)
  },
  workspaceSession: {
    get: (): Promise<import('../shared/readingProgress').WorkspaceSession | null> =>
      ipcRenderer.invoke('workspaceSession:get'),
    save: (session: import('../shared/readingProgress').WorkspaceSession): Promise<void> =>
      ipcRenderer.invoke('workspaceSession:save', session)
  },
  skills: {
    list: (): Promise<SkillListItem[]> => ipcRenderer.invoke('skills:list'),
    enable: (name: string): Promise<boolean> => ipcRenderer.invoke('skills:enable', name),
    disable: (name: string): Promise<boolean> => ipcRenderer.invoke('skills:disable', name),
    reload: (): Promise<SkillListItem[]> => ipcRenderer.invoke('skills:reload'),
    install: (): Promise<{ name: string; skills: SkillListItem[] } | null> =>
      ipcRenderer.invoke('skills:install'),
    delete: (name: string): Promise<SkillListItem[]> => ipcRenderer.invoke('skills:delete', name),
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
      ipcRenderer.on(IPC.ai.streamAborted, handler)
      return () => ipcRenderer.removeListener(IPC.ai.streamAborted, handler)
    },
    onToolStart: (
      cb: (requestId: string, toolCallId: string, name: string, args: Record<string, unknown>) => void
    ): (() => void) => {
      const handler = (
        _e: IpcRendererEvent,
        requestId: string,
        toolCallId: string,
        name: string,
        args: Record<string, unknown>
      ): void => cb(requestId, toolCallId, name, args)
      ipcRenderer.on(IPC.ai.toolStart, handler)
      return () => ipcRenderer.removeListener(IPC.ai.toolStart, handler)
    },
    onToolDone: (
      cb: (
        requestId: string,
        toolCallId: string,
        name: string,
        output: string,
        error?: string
      ) => void
    ): (() => void) => {
      const handler = (
        _e: IpcRendererEvent,
        requestId: string,
        toolCallId: string,
        name: string,
        output: string,
        error?: string
      ): void => cb(requestId, toolCallId, name, output, error)
      ipcRenderer.on(IPC.ai.toolDone, handler)
      return () => ipcRenderer.removeListener(IPC.ai.toolDone, handler)
    },
    onHitlRequest: (
      cb: (
        chatRequestId: string,
        hitlRequestId: string,
        toolName: string,
        args: Record<string, unknown>
      ) => void
    ): (() => void) => {
      const handler = (
        _e: IpcRendererEvent,
        chatRequestId: string,
        hitlRequestId: string,
        toolName: string,
        args: Record<string, unknown>
      ): void => cb(chatRequestId, hitlRequestId, toolName, args)
      ipcRenderer.on(IPC.ai.hitlRequest, handler)
      return () => ipcRenderer.removeListener(IPC.ai.hitlRequest, handler)
    },
    respondHitl: (hitlRequestId: string, approved: boolean): void => {
      ipcRenderer.send(IPC.ai.hitlResponse, hitlRequestId, approved)
    }
  },
  mcp: {
    list: (): Promise<McpServerState[]> => ipcRenderer.invoke(IPC.mcp.list),
    restart: (serverId: string): Promise<McpServerState[]> =>
      ipcRenderer.invoke(IPC.mcp.restart, serverId),
    toggle: (serverId: string, enabled: boolean): Promise<McpServerState[]> =>
      ipcRenderer.invoke(IPC.mcp.toggle, serverId, enabled)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
