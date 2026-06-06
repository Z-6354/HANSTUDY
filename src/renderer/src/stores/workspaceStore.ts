import { create } from 'zustand'
import { resolveWebInput, webDisplayName } from '../../../shared/webCrop'
import { getSearchEngine, getWebBrowseLayoutPrefs } from './appSettingsStore'
import { formatWebSnapshotTabTitle, type WebSnapshotMeta } from '../../../shared/webSnapshot'
import type { AnnotationTool, ChatMessage, TextSelectionContext } from '../types/global.d'

export type DocumentType = 'txt' | 'md' | 'pdf' | 'docx' | 'web' | 'web-snapshot' | 'settings' | 'unknown'
export type SidebarTab = 'explorer' | 'notes' | 'web'
export type SettingsSection = 'system' | 'skill' | 'mcp'

export type LayoutPanelId = 'sidebar' | 'tabBar' | 'annotationToolbar' | 'aiPanel'

export interface FloatingToolbarState {
  x: number
  y: number
  minimized: boolean
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

interface WorkspaceState {
  documents: OpenDocument[]
  activeDocumentId: string | null
  rootFolder: string | null
  fileTree: FileTreeEntry[]
  recentFiles: string[]
  showAIPanel: boolean
  showSidebar: boolean
  showTabBar: boolean
  showAnnotationToolbar: boolean
  floatingToolbar: FloatingToolbarState
  settingsSection: SettingsSection
  sidebarTab: SidebarTab
  selection: TextSelectionContext | null
  focusAnnotationId: string | null
  aiDraft: string
  annotationTick: number
  annotationTool: AnnotationTool
  annotationColor: string
  annotationStrokeWidth: number
  chatAttachedDoc: { path: string; name: string } | null
  chatDocContext: string | null
  webSnapshotTick: number
  webSession: WebViewSession | null
  webNavSeq: number
  webNavAction: { seq: number; action: WebNavAction; url?: string } | null
  openDocument: (doc: Omit<OpenDocument, 'id'>) => void
  openWebPage: (url: string) => boolean
  openWebSnapshot: (meta: WebSnapshotMeta) => void
  closeDocument: (id: string) => void
  closeOtherDocuments: (id: string) => void
  closeAllDocuments: () => void
  reorderDocuments: (fromId: string, toId: string) => void
  setActiveDocument: (id: string) => void
  setRootFolder: (path: string, files: FileTreeEntry[]) => void
  addRecentFile: (path: string) => void
  toggleAIPanel: () => void
  openAIPanel: () => void
  closeAIPanel: () => void
  toggleLayoutPanel: (panel: LayoutPanelId) => void
  openSidebar: (tab?: SidebarTab) => void
  closeSidebar: () => void
  setFloatingToolbar: (patch: Partial<FloatingToolbarState>) => void
  openSettings: (section?: SettingsSection) => void
  setSettingsSection: (section: SettingsSection) => void
  setSidebarTab: (tab: SidebarTab) => void
  setSelection: (selection: TextSelectionContext | null) => void
  setFocusAnnotationId: (id: string | null) => void
  setAiDraft: (draft: string) => void
  notifyAnnotationsChanged: () => void
  setAnnotationTool: (tool: AnnotationTool) => void
  setAnnotationColor: (color: string) => void
  setAnnotationStrokeWidth: (width: number) => void
  attachDocumentToChat: (path: string, name: string, content: string) => void
  detachDocumentFromChat: () => void
  notifyWebSnapshotsChanged: () => void
  setWebSession: (session: WebViewSession | null) => void
  updateWebSession: (docId: string, patch: Partial<Omit<WebViewSession, 'docId'>>) => void
  dispatchWebNav: (action: WebNavAction, url?: string) => void
  sendToAI: (text: string, docPath: string, range?: TextSelectionContext['range']) => void
}

const RECENT_KEY = 'hanstudy-recent-files'
const FLOATING_TOOLBAR_KEY = 'hanstudy-floating-toolbar'

function loadFloatingToolbar(): FloatingToolbarState {
  try {
    const raw = localStorage.getItem(FLOATING_TOOLBAR_KEY)
    if (raw) return JSON.parse(raw) as FloatingToolbarState
  } catch {
    // ignore
  }
  return { x: 0, y: 0, minimized: false }
}

function saveFloatingToolbar(state: FloatingToolbarState): void {
  localStorage.setItem(FLOATING_TOOLBAR_KEY, JSON.stringify(state))
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
  showAIPanel: true,
  showSidebar: true,
  showTabBar: true,
  showAnnotationToolbar: true,
  floatingToolbar: loadFloatingToolbar(),
  settingsSection: 'system' as SettingsSection,
  sidebarTab: 'explorer',
  selection: null,
  focusAnnotationId: null,
  aiDraft: '',
  annotationTick: 0,
  annotationTool: 'select' as AnnotationTool,
  annotationColor: '#f59e0b',
  annotationStrokeWidth: 2,
  chatAttachedDoc: null,
  chatDocContext: null,
  webSnapshotTick: 0,
  webSession: null,
  webNavSeq: 0,
  webNavAction: null,

  openDocument: (doc) => {
    const existing = get().documents.find((d) => d.path === doc.path)
    if (existing) {
      set({ activeDocumentId: existing.id, selection: null })
      if (doc.path !== SETTINGS_DOC_PATH) {
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
    if (doc.path !== SETTINGS_DOC_PATH) {
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
    get().openDocument({
      path: url,
      name: webDisplayName(url),
      type: 'web'
    })
    return true
  },

  openWebSnapshot: (meta) => {
    get().openDocument({
      path: meta.pdfPath,
      name: formatWebSnapshotTabTitle(meta.title),
      type: 'web-snapshot'
    })
  },

  notifyWebSnapshotsChanged: () => {
    set((state) => ({ webSnapshotTick: state.webSnapshotTick + 1 }))
  },

  setWebSession: (session) => set({ webSession: session }),

  updateWebSession: (docId, patch) => {
    set((state) => {
      if (!state.webSession || state.webSession.docId !== docId) {
        return {
          webSession: {
            docId,
            currentUrl: patch.currentUrl ?? '',
            title: patch.title ?? '',
            loading: patch.loading ?? false,
            canGoBack: patch.canGoBack ?? false,
            canGoForward: patch.canGoForward ?? false
          }
        }
      }
      return { webSession: { ...state.webSession, ...patch } }
    })
  },

  dispatchWebNav: (action, url) => {
    set((state) => ({
      webNavSeq: state.webNavSeq + 1,
      webNavAction: { seq: state.webNavSeq + 1, action, url }
    }))
  },

  closeDocument: (id) => {
    set((state) => {
      const documents = state.documents.filter((d) => d.id !== id)
      let activeDocumentId = state.activeDocumentId
      if (activeDocumentId === id) {
        activeDocumentId = documents.length > 0 ? documents[documents.length - 1].id : null
      }
      const webSession = state.webSession?.docId === id ? null : state.webSession
      return { documents, activeDocumentId, selection: null, webSession }
    })
  },

  closeOtherDocuments: (id) => {
    set((state) => {
      const documents = state.documents.filter((d) => d.id === id)
      return {
        documents,
        activeDocumentId: documents.length > 0 ? id : null,
        selection: null
      }
    })
  },

  closeAllDocuments: () => set({ documents: [], activeDocumentId: null, selection: null }),

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

  setRootFolder: (path, files) => {
    set({ rootFolder: path, fileTree: files })
    void window.api.skills.setProjectDir(path)
  },

  addRecentFile: (path) => {
    set((state) => {
      const recentFiles = [path, ...state.recentFiles.filter((f) => f !== path)].slice(0, 20)
      saveRecent(recentFiles)
      return { recentFiles }
    })
  },

  toggleAIPanel: () => set((state) => ({ showAIPanel: !state.showAIPanel })),

  openAIPanel: () => set({ showAIPanel: true }),

  closeAIPanel: () => set({ showAIPanel: false }),

  toggleLayoutPanel: (panel) => {
    set((state) => {
      switch (panel) {
        case 'sidebar':
          return { showSidebar: !state.showSidebar }
        case 'tabBar':
          return { showTabBar: !state.showTabBar }
        case 'annotationToolbar':
          return { showAnnotationToolbar: !state.showAnnotationToolbar }
        case 'aiPanel':
          return { showAIPanel: !state.showAIPanel }
        default:
          return state
      }
    })
  },

  openSidebar: (tab) => {
    set((state) => ({
      showSidebar: true,
      sidebarTab: tab ?? state.sidebarTab
    }))
  },

  closeSidebar: () => set({ showSidebar: false }),

  setFloatingToolbar: (patch) => {
    set((state) => {
      const floatingToolbar = { ...state.floatingToolbar, ...patch }
      saveFloatingToolbar(floatingToolbar)
      return { floatingToolbar }
    })
  },

  openSettings: (section = 'system') => {
    const existing = get().documents.find((d) => d.path === SETTINGS_DOC_PATH)
    if (existing) {
      set({ activeDocumentId: existing.id, settingsSection: section, selection: null })
      return
    }
    get().openDocument({
      path: SETTINGS_DOC_PATH,
      name: '软件设置',
      type: 'settings'
    })
    set({ settingsSection: section })
  },

  setSettingsSection: (section) => set({ settingsSection: section }),

  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  setSelection: (selection) => set({ selection }),

  setFocusAnnotationId: (id) => set({ focusAnnotationId: id }),

  setAiDraft: (draft) => set({ aiDraft: draft }),

  notifyAnnotationsChanged: () =>
    set((state) => ({ annotationTick: state.annotationTick + 1 })),

  setAnnotationTool: (tool) => set({ annotationTool: tool }),

  setAnnotationColor: (color) => set({ annotationColor: color }),

  setAnnotationStrokeWidth: (width) => set({ annotationStrokeWidth: width }),

  attachDocumentToChat: (path, name, content) =>
    set({ chatAttachedDoc: { path, name }, chatDocContext: content }),

  detachDocumentFromChat: () => set({ chatAttachedDoc: null, chatDocContext: null }),

  sendToAI: (text, docPath, range) => {
    set({
      showAIPanel: true,
      selection: { docPath, text, range },
      aiDraft: `请解释以下内容：\n\n${text.slice(0, 500)}`
    })
  }
}))
