import { create } from 'zustand'
import type { AnnotationTool, ChatMessage, TextSelectionContext } from '../types/global.d'

export type DocumentType = 'txt' | 'md' | 'pdf' | 'docx' | 'settings' | 'unknown'
export type SidebarTab = 'explorer' | 'notes'
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
  openDocument: (doc: Omit<OpenDocument, 'id'>) => void
  closeDocument: (id: string) => void
  closeOtherDocuments: (id: string) => void
  closeAllDocuments: () => void
  reorderDocuments: (fromId: string, toId: string) => void
  setActiveDocument: (id: string) => void
  setRootFolder: (path: string, files: FileTreeEntry[]) => void
  addRecentFile: (path: string) => void
  toggleAIPanel: () => void
  toggleLayoutPanel: (panel: LayoutPanelId) => void
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

  closeDocument: (id) => {
    set((state) => {
      const documents = state.documents.filter((d) => d.id !== id)
      let activeDocumentId = state.activeDocumentId
      if (activeDocumentId === id) {
        activeDocumentId = documents.length > 0 ? documents[documents.length - 1].id : null
      }
      return { documents, activeDocumentId, selection: null }
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

  setRootFolder: (path, files) => set({ rootFolder: path, fileTree: files }),

  addRecentFile: (path) => {
    set((state) => {
      const recentFiles = [path, ...state.recentFiles.filter((f) => f !== path)].slice(0, 20)
      saveRecent(recentFiles)
      return { recentFiles }
    })
  },

  toggleAIPanel: () => set((state) => ({ showAIPanel: !state.showAIPanel })),

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
