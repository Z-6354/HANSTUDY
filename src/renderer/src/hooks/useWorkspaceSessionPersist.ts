import { useEffect, useRef } from 'react'
import type { SavedDocumentType, WorkspaceSession } from '@shared/readingProgress'
import { SETTINGS_DOC_PATH, useWorkspaceStore, type OpenDocument } from '../stores/workspaceStore'

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
    updatedAt: new Date().toISOString()
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
      if (!session?.documents?.length) return

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
          if (info.type === 'unknown' && doc.type !== 'web-snapshot') {
            failed.push(doc.path)
            continue
          }
          store.openDocument({
            path: doc.path,
            name: doc.name || info.name,
            type: (info.type === 'unknown' ? doc.type : info.type) as OpenDocument['type']
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
      if (session.documents.length === 0) return
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
        state.activeDocumentId === prev.activeDocumentId
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

