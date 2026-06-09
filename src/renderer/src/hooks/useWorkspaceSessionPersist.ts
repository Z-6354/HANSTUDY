import { useEffect, useRef } from 'react'
import type { SavedDocumentType, WorkspaceSession } from '@shared/readingProgress'
import { SETTINGS_DOC_PATH, saveLayoutPanelPrefs, useWorkspaceStore, type OpenDocument, type SidebarTab } from '../stores/workspaceStore'

const SAVE_DEBOUNCE_MS = 800

function toSavedDoc(doc: OpenDocument): { path: string; name: string; type: SavedDocumentType } | null {
  if (doc.path === SETTINGS_DOC_PATH || doc.type === 'settings') return null
  return { path: doc.path, name: doc.name, type: doc.type as SavedDocumentType }
}

function buildSession(state: ReturnType<typeof useWorkspaceStore.getState>): WorkspaceSession {
  const documents = state.documents
    .map(toSavedDoc)
    .filter((d): d is NonNullable<typeof d> => d != null)
  const active = state.documents.find((d) => d.id === state.activeDocumentId)
  return {
    documents,
    activePath: active && active.path !== SETTINGS_DOC_PATH ? active.path : documents[0]?.path ?? null,
    rootFolder: state.rootFolder,
    showSidebar: state.showSidebar,
    showAIPanel: state.showAIPanel,
    sidebarTab: state.sidebarTab,
    updatedAt: new Date().toISOString()
  }
}

function applyLayoutFromSession(session: WorkspaceSession): void {
  const store = useWorkspaceStore.getState()
  const patch: Partial<ReturnType<typeof useWorkspaceStore.getState>> = {}
  if (session.showSidebar != null) patch.showSidebar = session.showSidebar
  if (session.showAIPanel != null) patch.showAIPanel = session.showAIPanel
  if (session.sidebarTab) patch.sidebarTab = session.sidebarTab as SidebarTab
  if (Object.keys(patch).length > 0) {
    useWorkspaceStore.setState(patch)
    const next = useWorkspaceStore.getState()
    saveLayoutPanelPrefs(next.showSidebar, next.showAIPanel, next.sidebarTab)
  }
}

export function useWorkspaceSessionPersist(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restoredRef = useRef(false)

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    void (async () => {
      const session = await window.api.workspaceSession.get()
      if (!session) return

      applyLayoutFromSession(session)

      if (session.rootFolder) {
        try {
          const items = await window.api.fs.listDirectory(session.rootFolder)
          useWorkspaceStore.getState().setRootFolder(session.rootFolder, items)
        } catch {
          // 目录不可用，由 FileExplorer 回退到默认资料库
        }
      }

      if (!session.documents?.length) return

      const store = useWorkspaceStore.getState()
      if (store.documents.length > 0) return

      const failed: string[] = []

      for (const doc of session.documents) {
        if (doc.type === 'web') {
          store.openWebPage(doc.path)
          continue
        }
        try {
          const info = await window.api.fs.getFileInfo(doc.path)
          if (info.type === 'unknown') {
            failed.push(doc.path)
            continue
          }
          store.openDocument({
            path: doc.path,
            name: doc.name || info.name,
            type: info.type as OpenDocument['type']
          })
        } catch {
          failed.push(doc.path)
        }
      }

      if (failed.length > 0) {
        store.setViewerStatus({
          detail: `部分文档无法恢复（${failed.length} 个）：${failed.slice(0, 3).join('；')}${failed.length > 3 ? '…' : ''}`
        })
      }

      if (session.activePath) {
        const target = useWorkspaceStore
          .getState()
          .documents.find((d) => d.path === session.activePath)
        if (target) store.setActiveDocument(target.id)
      }
    })()
  }, [])

  useEffect(() => {
    const persist = (): void => {
      const session = buildSession(useWorkspaceStore.getState())
      void window.api.workspaceSession.save(session)
    }

    const schedule = (): void => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        persist()
      }, SAVE_DEBOUNCE_MS)
    }

    const unsub = useWorkspaceStore.subscribe((state, prev) => {
      if (
        state.documents === prev.documents &&
        state.activeDocumentId === prev.activeDocumentId &&
        state.rootFolder === prev.rootFolder &&
        state.showSidebar === prev.showSidebar &&
        state.showAIPanel === prev.showAIPanel &&
        state.sidebarTab === prev.sidebarTab
      ) {
        return
      }
      schedule()
    })

    const onBeforeUnload = (): void => {
      if (timerRef.current) clearTimeout(timerRef.current)
      persist()
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      unsub()
      window.removeEventListener('beforeunload', onBeforeUnload)
      if (timerRef.current) clearTimeout(timerRef.current)
      persist()
    }
  }, [])
}
