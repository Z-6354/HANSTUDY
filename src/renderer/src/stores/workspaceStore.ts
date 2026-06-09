import { create } from 'zustand'
import { mergeChatContextItems, type ChatContextItem } from '@shared/aiContext'
import { resolveWebInput, webUrlKey } from '@shared/webCrop'
import { webDisplayTitle } from '@shared/webLibrary'
import { useWebLibraryStore } from './webLibraryStore'
import { getSearchEngine, getWebBrowseLayoutPrefs } from './appSettingsStore'
import type { DocumentNoteAnchor, NoteSortMode } from '@shared/documentNotes'
import type { ChatMessage, TextSelectionContext, WorkbenchMode } from '../types/global.d'

const NOTE_SORT_MODE_KEY = 'hanstudy-note-sort-mode'
const ACTIVE_NOTEBOOK_KEY = 'hanstudy-active-notebook-id'

function loadNoteSortMode(): NoteSortMode | null {
  try {
    const raw = localStorage.getItem(NOTE_SORT_MODE_KEY)
    if (raw === 'document' || raw === 'history' || raw === 'manual') return raw
    return null
  } catch {
    return null
  }
}

function saveNoteSortMode(mode: NoteSortMode | null): void {
  try {
    if (mode == null) localStorage.removeItem(NOTE_SORT_MODE_KEY)
    else localStorage.setItem(NOTE_SORT_MODE_KEY, mode)
  } catch {
    // ignore
  }
}

function loadActiveNotebookId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_NOTEBOOK_KEY)
  } catch {
    return null
  }
}

function saveActiveNotebookId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_NOTEBOOK_KEY, id)
    else localStorage.removeItem(ACTIVE_NOTEBOOK_KEY)
  } catch {
    // ignore
  }
}

export type { ChatContextItem }

function genContextId(): string {
  return `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export type DocumentType = 'txt' | 'md' | 'pdf' | 'docx' | 'web' | 'settings' | 'unknown'
export type SidebarTab = 'explorer' | 'notes' | 'web'
export type SettingsSection = 'system' | 'skill' | 'mcp'

export type LayoutPanelId = 'sidebar' | 'tabBar' | 'aiPanel' | 'globalSearchBar'

export type ViewerCommandKind = 'find' | 'selectAll'

export interface ViewerCommand {
  seq: number
  kind: ViewerCommandKind
}

export const SETTINGS_DOC_PATH = '__hanstudy_settings__'

export interface OpenDocument {
  id: string
  path: string
  name: string
  type: DocumentType
}

export interface FileTreeEntry {
  name: string
  path: string
  isDirectory: boolean
}

export type WebNavAction = 'back' | 'forward' | 'reload' | 'navigate'

export interface WebViewSession {
  docId: string
  currentUrl: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

interface LayoutRestore {
  showSidebar: boolean
  showAIPanel: boolean
}

interface ViewerStatus {
  detail?: string
}

export interface NoteInsertRequest {
  seq: number
  markdown: string
  source?: string
  aiSessionId?: string
}

export interface NoteFocusRequest {
  seq: number
  entryId: string
  notebookId?: string
}

interface WorkspaceState {
  documents: OpenDocument[]
  activeDocumentId: string | null
  rootFolder: string | null
  fileTree: FileTreeEntry[]
  recentFiles: string[]
  showAIPanel: boolean
  showSidebar: boolean
  showTabBar: boolean
  showGlobalSearchBar: boolean
  workbenchMode: WorkbenchMode
  activeNotePath: string | null
  settingsSection: SettingsSection
  sidebarTab: SidebarTab
  selection: TextSelectionContext | null
  aiDraft: string
  chatContextItems: ChatContextItem[]
  noteInsertRequest: NoteInsertRequest | null
  noteInsertSeq: number
  noteFocusRequest: NoteFocusRequest | null
  noteFocusSeq: number
  webSessions: Record<string, WebViewSession>
  webNavSeq: number
  webNavAction: { seq: number; action: WebNavAction; url?: string } | null
  focusMode: boolean
  focusModeRestore: LayoutRestore | null
  viewerStatus: ViewerStatus | null
  viewerCommandSeq: number
  viewerCommand: ViewerCommand | null
  readerNavigateSeq: number
  readerNavigate: { seq: number; anchor: DocumentNoteAnchor } | null
  noteSortMode: NoteSortMode | null
  activeNotebookId: string | null
  findBarOpen: boolean
  findQuery: string
  findMatchIndex: number
  findMatchCount: number
  findStepSeq: number
  findStepForward: boolean
  openDocument: (doc: Omit<OpenDocument, 'id'>) => void
  openWebPage: (url: string) => boolean
  closeDocument: (id: string) => void
  closeOtherDocuments: (id: string) => void
  closeAllDocuments: () => void
  reorderDocuments: (fromId: string, toId: string) => void
  setActiveDocument: (id: string) => void
  renameDocument: (id: string, name: string) => void
  setRootFolder: (path: string, files: FileTreeEntry[]) => void
  clearRootFolder: () => void
  addRecentFile: (path: string) => void
  toggleAIPanel: () => void
  openAIPanel: () => void
  closeAIPanel: () => void
  toggleLayoutPanel: (panel: LayoutPanelId) => void
  openSidebar: (tab?: SidebarTab) => void
  closeSidebar: () => void
  openSettings: (section?: SettingsSection) => void
  setSettingsSection: (section: SettingsSection) => void
  setSidebarTab: (tab: SidebarTab) => void
  setWorkbenchMode: (mode: WorkbenchMode) => void
  setActiveNotePath: (path: string | null) => void
  setSelection: (selection: TextSelectionContext | null) => void
  setAiDraft: (draft: string) => void
  addChatContextItem: (
    item: Omit<ChatContextItem, 'id'> & { id?: string }
  ) => void
  removeChatContextItem: (id: string) => void
  clearChatContextItems: () => void
  getMergedChatContext: () => { fileName: string; content: string } | undefined
  requestNoteInsert: (markdown: string, source?: string, aiSessionId?: string) => void
  clearNoteInsertRequest: () => void
  requestNoteFocus: (entryId: string, notebookId?: string) => void
  clearNoteFocusRequest: () => void
  setWebSession: (session: WebViewSession | null) => void
  clearWebSession: (docId: string) => void
  updateWebSession: (docId: string, patch: Partial<Omit<WebViewSession, 'docId'>>) => void
  dispatchWebNav: (action: WebNavAction, url?: string) => void
  clearWebNavAction: () => void
  sendToAI: (text: string, docPath: string, range?: TextSelectionContext['range']) => void
  toggleFocusMode: () => void
  exitFocusMode: () => void
  setViewerStatus: (status: ViewerStatus | null) => void
  dispatchViewerCommand: (kind: ViewerCommandKind) => void
  closeFindBar: () => void
  setFindQuery: (query: string) => void
  setFindMatchStats: (index: number, count: number) => void
  stepFind: (forward: boolean) => void
  dispatchReaderNavigate: (anchor: DocumentNoteAnchor) => void
  setNoteSortMode: (mode: NoteSortMode | null) => void
  setActiveNotebookId: (id: string | null) => void
}

const RECENT_KEY = 'hanstudy-recent-files'
const WORKBENCH_MODE_KEY = 'hanstudy-workbench-mode'
const SHOW_SIDEBAR_KEY = 'hanstudy-show-sidebar'
const SHOW_AI_PANEL_KEY = 'hanstudy-show-ai-panel'
const SHOW_GLOBAL_SEARCH_KEY = 'hanstudy-show-global-search'
const SIDEBAR_TAB_KEY = 'hanstudy-sidebar-tab'

function loadShowSidebar(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_SIDEBAR_KEY)
    if (raw === 'false') return false
    if (raw === 'true') return true
  } catch {
    // ignore
  }
  return true
}

function loadShowAIPanel(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_AI_PANEL_KEY)
    if (raw === 'false') return false
    if (raw === 'true') return true
  } catch {
    // ignore
  }
  return true
}

function loadShowGlobalSearchBar(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_GLOBAL_SEARCH_KEY)
    if (raw === 'false') return false
    if (raw === 'true') return true
  } catch {
    // ignore
  }
  return true
}

function saveShowGlobalSearchBar(show: boolean): void {
  try {
    localStorage.setItem(SHOW_GLOBAL_SEARCH_KEY, String(show))
  } catch {
    // ignore
  }
}

function loadSidebarTab(): SidebarTab {
  try {
    const raw = localStorage.getItem(SIDEBAR_TAB_KEY)
    if (raw === 'explorer' || raw === 'notes' || raw === 'web') return raw
  } catch {
    // ignore
  }
  return 'explorer'
}

export function saveLayoutPanelPrefs(
  showSidebar: boolean,
  showAIPanel: boolean,
  sidebarTab: SidebarTab
): void {
  try {
    localStorage.setItem(SHOW_SIDEBAR_KEY, String(showSidebar))
    localStorage.setItem(SHOW_AI_PANEL_KEY, String(showAIPanel))
    localStorage.setItem(SIDEBAR_TAB_KEY, sidebarTab)
  } catch {
    // ignore
  }
}

function loadWorkbenchMode(): WorkbenchMode {
  try {
    const raw = localStorage.getItem(WORKBENCH_MODE_KEY)
    if (raw === 'compose' || raw === 'feedback' || raw === 'generate') return raw
    return 'browse'
  } catch {
    return 'browse'
  }
}

function saveWorkbenchMode(mode: WorkbenchMode): void {
  localStorage.setItem(WORKBENCH_MODE_KEY, mode)
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveRecent(files: string[]): void {
  localStorage.setItem(RECENT_KEY, JSON.stringify(files.slice(0, 20)))
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  documents: [],
  activeDocumentId: null,
  rootFolder: null,
  fileTree: [],
  recentFiles: loadRecent(),
  showAIPanel: loadShowAIPanel(),
  showSidebar: loadShowSidebar(),
  showTabBar: true,
  showGlobalSearchBar: loadShowGlobalSearchBar(),
  workbenchMode: loadWorkbenchMode(),
  activeNotePath: null,
  settingsSection: 'system' as SettingsSection,
  sidebarTab: loadSidebarTab(),
  selection: null,
  aiDraft: '',
  chatContextItems: [],
  noteInsertRequest: null,
  noteInsertSeq: 0,
  noteFocusRequest: null,
  noteFocusSeq: 0,
  webSessions: {},
  webNavSeq: 0,
  webNavAction: null,
  focusMode: false,
  focusModeRestore: null,
  viewerStatus: null,
  viewerCommandSeq: 0,
  viewerCommand: null,
  readerNavigateSeq: 0,
  readerNavigate: null,
  noteSortMode: loadNoteSortMode(),
  activeNotebookId: loadActiveNotebookId(),
  findBarOpen: false,
  findQuery: '',
  findMatchIndex: 0,
  findMatchCount: 0,
  findStepSeq: 0,
  findStepForward: true,

  openDocument: (doc) => {
    const existing = get().documents.find((d) => d.path === doc.path)
    if (existing) {
      set({ activeDocumentId: existing.id, selection: null })
      if (doc.path !== SETTINGS_DOC_PATH && doc.type !== 'web') {
        get().addRecentFile(doc.path)
      }
      return
    }

    const id = doc.path === SETTINGS_DOC_PATH ? SETTINGS_DOC_PATH : `${doc.path}-${Date.now()}`
    const newDoc: OpenDocument = { ...doc, id }
    set((state) => ({
      documents: [...state.documents, newDoc],
      activeDocumentId: id,
      selection: null
    }))
    if (doc.path !== SETTINGS_DOC_PATH && doc.type !== 'web') {
      get().addRecentFile(doc.path)
    }
  },

  openWebPage: (rawUrl) => {
    const url = resolveWebInput(rawUrl, getSearchEngine())
    if (!url) return false
    const layout = getWebBrowseLayoutPrefs()
    set((state) => ({
      showSidebar: layout.webBrowseHideSidebar ? false : state.showSidebar,
      showAIPanel: layout.webBrowseHideAIPanel ? false : state.showAIPanel
    }))
    const afterWeb = get()
    saveLayoutPanelPrefs(afterWeb.showSidebar, afterWeb.showAIPanel, afterWeb.sidebarTab)
    const key = webUrlKey(url)
    const historyTitle = useWebLibraryStore
      .getState()
      .history.find((h) => webUrlKey(h.url) === key)?.title
    const resolveWebTabName = (sessionTitle?: string): string =>
      webDisplayTitle(sessionTitle || historyTitle || '', url)

    const existing = get().documents.find((d) => d.type === 'web' && webUrlKey(d.path) === key)
    if (existing) {
      const sessionTitle = get().webSessions[existing.id]?.title
      const name = resolveWebTabName(sessionTitle)
      if (name !== existing.name && name !== '网页') {
        get().renameDocument(existing.id, name)
      }
      set({ activeDocumentId: existing.id, selection: null })
      get().dispatchWebNav('navigate', url)
      return true
    }
    get().openDocument({
      path: url,
      name: resolveWebTabName(),
      type: 'web'
    })
    return true
  },

  setWebSession: (session) =>
    set((state) => {
      if (!session) return { webSessions: {} }
      return {
        webSessions: { ...state.webSessions, [session.docId]: session }
      }
    }),

  clearWebSession: (docId) =>
    set((state) => {
      const webSessions = { ...state.webSessions }
      delete webSessions[docId]
      return { webSessions }
    }),

  updateWebSession: (docId, patch) => {
    set((state) => {
      const existing = state.webSessions[docId]
      const next: WebViewSession = existing
        ? { ...existing, ...patch }
        : {
            docId,
            currentUrl: patch.currentUrl ?? '',
            title: patch.title ?? '',
            loading: patch.loading ?? false,
            canGoBack: patch.canGoBack ?? false,
            canGoForward: patch.canGoForward ?? false
          }
      return { webSessions: { ...state.webSessions, [docId]: next } }
    })
  },

  dispatchWebNav: (action, url) => {
    set((state) => ({
      webNavSeq: state.webNavSeq + 1,
      webNavAction: { seq: state.webNavSeq + 1, action, url }
    }))
  },

  clearWebNavAction: () => set({ webNavAction: null }),

  closeDocument: (id) => {
    const closed = get().documents.find((d) => d.id === id)
    if (closed?.type === 'web') {
      void window.api.webGuest.destroyDoc(id)
    }
    set((state) => {
      const documents = state.documents.filter((d) => d.id !== id)
      let activeDocumentId = state.activeDocumentId
      if (activeDocumentId === id) {
        activeDocumentId = documents.length > 0 ? documents[documents.length - 1].id : null
      }
      const webSessions = { ...state.webSessions }
      delete webSessions[id]
      const detachChat =
        closed != null &&
        state.chatContextItems.some(
          (item) => item.kind === 'document' && item.docPath === closed.path
        )
      return {
        documents,
        activeDocumentId,
        selection: null,
        webSessions,
        ...(detachChat
          ? {
              chatContextItems: state.chatContextItems.filter(
                (item) => !(item.kind === 'document' && item.docPath === closed!.path)
              )
            }
          : {})
      }
    })
  },

  closeOtherDocuments: (id) => {
    const removed = get().documents.filter((d) => d.id !== id)
    for (const doc of removed) {
      if (doc.type === 'web') void window.api.webGuest.destroyDoc(doc.id)
    }
    set((state) => {
      const documents = state.documents.filter((d) => d.id === id)
      const webSessions: Record<string, WebViewSession> = {}
      if (state.webSessions[id]) {
        webSessions[id] = state.webSessions[id]
      }
      const keptPaths = new Set(documents.map((d) => d.path))
      const detachChat = state.chatContextItems.some(
        (item) => item.kind === 'document' && item.docPath && !keptPaths.has(item.docPath)
      )
      return {
        documents,
        activeDocumentId: documents.length > 0 ? id : null,
        selection: null,
        webSessions,
        ...(detachChat
          ? {
              chatContextItems: state.chatContextItems.filter(
                (item) =>
                  item.kind !== 'document' || !item.docPath || keptPaths.has(item.docPath)
              )
            }
          : {})
      }
    })
  },

  closeAllDocuments: () => {
    for (const doc of get().documents) {
      if (doc.type === 'web') void window.api.webGuest.destroyDoc(doc.id)
    }
    set((state) => ({
      documents: [],
      activeDocumentId: null,
      selection: null,
      webSessions: {},
      chatContextItems: state.chatContextItems.filter((item) => item.kind !== 'document')
    }))
  },

  reorderDocuments: (fromId, toId) => {
    set((state) => {
      const documents = [...state.documents]
      const fromIdx = documents.findIndex((d) => d.id === fromId)
      const toIdx = documents.findIndex((d) => d.id === toId)
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return state
      const [moved] = documents.splice(fromIdx, 1)
      documents.splice(toIdx, 0, moved)
      return { documents }
    })
  },

  setActiveDocument: (id) => set({ activeDocumentId: id, selection: null }),

  renameDocument: (id, name) =>
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, name } : d))
    })),

  setRootFolder: (path, files) => {
    set({ rootFolder: path, fileTree: files })
    void window.api.skills.setProjectDir(path)
  },

  clearRootFolder: () => {
    set({ rootFolder: null, fileTree: [] })
    void window.api.skills.setProjectDir(null)
  },

  addRecentFile: (path) => {
    set((state) => {
      const recentFiles = [path, ...state.recentFiles.filter((f) => f !== path)].slice(0, 20)
      saveRecent(recentFiles)
      return { recentFiles }
    })
  },

  toggleAIPanel: () =>
    set((state) => {
      const showAIPanel = !state.showAIPanel
      saveLayoutPanelPrefs(state.showSidebar, showAIPanel, state.sidebarTab)
      return { showAIPanel }
    }),

  openAIPanel: () =>
    set((state) => {
      saveLayoutPanelPrefs(state.showSidebar, true, state.sidebarTab)
      return { showAIPanel: true }
    }),

  closeAIPanel: () =>
    set((state) => {
      saveLayoutPanelPrefs(state.showSidebar, false, state.sidebarTab)
      return { showAIPanel: false }
    }),

  toggleLayoutPanel: (panel) => {
    set((state) => {
      switch (panel) {
        case 'sidebar': {
          const showSidebar = !state.showSidebar
          saveLayoutPanelPrefs(showSidebar, state.showAIPanel, state.sidebarTab)
          return { showSidebar }
        }
        case 'tabBar':
          return { showTabBar: !state.showTabBar }
        case 'globalSearchBar': {
          const showGlobalSearchBar = !state.showGlobalSearchBar
          saveShowGlobalSearchBar(showGlobalSearchBar)
          return { showGlobalSearchBar }
        }
        case 'aiPanel': {
          const showAIPanel = !state.showAIPanel
          saveLayoutPanelPrefs(state.showSidebar, showAIPanel, state.sidebarTab)
          return { showAIPanel }
        }
        default:
          return state
      }
    })
  },

  openSidebar: (tab) => {
    set((state) => {
      const sidebarTab = tab ?? state.sidebarTab
      saveLayoutPanelPrefs(true, state.showAIPanel, sidebarTab)
      return { showSidebar: true, sidebarTab }
    })
  },

  closeSidebar: () =>
    set((state) => {
      saveLayoutPanelPrefs(false, state.showAIPanel, state.sidebarTab)
      return { showSidebar: false }
    }),

  openSettings: (section = 'system') => {
    saveWorkbenchMode('browse')
    const existing = get().documents.find((d) => d.path === SETTINGS_DOC_PATH)
    if (existing) {
      set({
        workbenchMode: 'browse',
        activeDocumentId: existing.id,
        settingsSection: section,
        selection: null
      })
      return
    }
    get().openDocument({
      path: SETTINGS_DOC_PATH,
      name: '软件设置',
      type: 'settings'
    })
    set({ workbenchMode: 'browse', settingsSection: section })
  },

  setSettingsSection: (section) => set({ settingsSection: section }),

  setSidebarTab: (tab) =>
    set((state) => {
      saveLayoutPanelPrefs(state.showSidebar, state.showAIPanel, tab)
      return { sidebarTab: tab }
    }),

  setWorkbenchMode: (mode) => {
    saveWorkbenchMode(mode)
    set({ workbenchMode: mode })
  },

  setActiveNotePath: (path) => set({ activeNotePath: path }),

  setSelection: (selection) => set({ selection }),

  setAiDraft: (draft) => set({ aiDraft: draft }),

  addChatContextItem: (item) =>
    set((state) => {
      const id = item.id ?? genContextId()
      const next: ChatContextItem = { ...item, id }
      const withoutDup = state.chatContextItems.filter((existing) => {
        if (next.noteEntryId && existing.noteEntryId === next.noteEntryId) return false
        if (
          next.kind === 'document' &&
          existing.kind === 'document' &&
          next.docPath &&
          existing.docPath === next.docPath
        ) {
          return false
        }
        return true
      })
      saveLayoutPanelPrefs(state.showSidebar, true, state.sidebarTab)
      return { chatContextItems: [...withoutDup, next], showAIPanel: true }
    }),

  removeChatContextItem: (id) =>
    set((state) => ({
      chatContextItems: state.chatContextItems.filter((item) => item.id !== id)
    })),

  clearChatContextItems: () => set({ chatContextItems: [] }),

  getMergedChatContext: () => mergeChatContextItems(get().chatContextItems),

  requestNoteInsert: (markdown, source, aiSessionId) =>
    set((state) => {
      const request = {
        seq: state.noteInsertSeq + 1,
        markdown,
        source,
        aiSessionId
      }
      if (state.workbenchMode === 'browse' || state.workbenchMode === 'generate') {
        return {
          noteInsertSeq: request.seq,
          noteInsertRequest: request
        }
      }
      saveLayoutPanelPrefs(true, state.showAIPanel, 'notes')
      return {
        noteInsertSeq: request.seq,
        noteInsertRequest: request,
        workbenchMode: 'compose',
        sidebarTab: 'notes',
        showSidebar: true
      }
    }),

  clearNoteInsertRequest: () => set({ noteInsertRequest: null }),

  requestNoteFocus: (entryId, notebookId) =>
    set((state) => ({
      noteFocusSeq: state.noteFocusSeq + 1,
      noteFocusRequest: { seq: state.noteFocusSeq + 1, entryId, notebookId },
      workbenchMode: 'compose'
    })),

  clearNoteFocusRequest: () => set({ noteFocusRequest: null }),

  sendToAI: (text, docPath, range) => {
    const state = get()
    saveLayoutPanelPrefs(state.showSidebar, true, state.sidebarTab)
    set({
      showAIPanel: true,
      selection: { docPath, text, range },
      aiDraft: `请解释以下内容：\n\n${text.slice(0, 500)}`
    })
  },

  toggleFocusMode: () => {
    const state = get()
    if (state.focusMode) {
      get().exitFocusMode()
      return
    }
    set({
      focusMode: true,
      focusModeRestore: { showSidebar: state.showSidebar, showAIPanel: state.showAIPanel },
      showSidebar: false,
      showAIPanel: false
    })
  },

  exitFocusMode: () => {
    const state = get()
    if (!state.focusMode) return
    const restore = state.focusModeRestore
    const showSidebar = restore?.showSidebar ?? state.showSidebar
    const showAIPanel = restore?.showAIPanel ?? state.showAIPanel
    saveLayoutPanelPrefs(showSidebar, showAIPanel, state.sidebarTab)
    set({
      focusMode: false,
      focusModeRestore: null,
      showSidebar,
      showAIPanel
    })
  },

  setViewerStatus: (status) => set({ viewerStatus: status }),

  dispatchViewerCommand: (kind) => {
    const seq = get().viewerCommandSeq + 1
    const patch: Partial<WorkspaceState> = {
      viewerCommand: { seq, kind },
      viewerCommandSeq: seq
    }
    if (kind === 'find') {
      patch.findBarOpen = true
      patch.findQuery = ''
      patch.findMatchIndex = 0
      patch.findMatchCount = 0
      patch.findStepSeq = 0
    }
    set(patch)
  },

  closeFindBar: () =>
    set({
      findBarOpen: false,
      findQuery: '',
      findMatchIndex: 0,
      findMatchCount: 0
    }),

  setFindQuery: (query) =>
    set({
      findQuery: query,
      findMatchIndex: 0,
      findMatchCount: 0,
      findStepSeq: get().findStepSeq + 1,
      findStepForward: true
    }),

  setFindMatchStats: (index, count) => set({ findMatchIndex: index, findMatchCount: count }),

  stepFind: (forward) =>
    set((state) => ({
      findStepForward: forward,
      findStepSeq: state.findStepSeq + 1
    })),

  dispatchReaderNavigate: (anchor) => {
    const seq = get().readerNavigateSeq + 1
    set({
      readerNavigate: { seq, anchor },
      readerNavigateSeq: seq,
      workbenchMode: 'compose'
    })
  },

  setNoteSortMode: (mode) => {
    saveNoteSortMode(mode)
    set({ noteSortMode: mode })
  },

  setActiveNotebookId: (id) => {
    saveActiveNotebookId(id)
    set({ activeNotebookId: id, noteSortMode: null })
  }
}))
