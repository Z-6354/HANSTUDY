import { useEffect } from 'react'
import { insertAiNoteEntry } from '../features/notes/insertAiNoteEntry'
import { useWorkspaceStore } from '../stores/workspaceStore'

/** 浏览 / 生成模式下 AI 或编辑器「加入笔记」：后台写入并提示，不切换工作区 */
export function useBrowseModeNoteInsert(): void {
  const workbenchMode = useWorkspaceStore((s) => s.workbenchMode)
  const noteInsertRequest = useWorkspaceStore((s) => s.noteInsertRequest)

  useEffect(() => {
    if (
      (workbenchMode !== 'browse' && workbenchMode !== 'generate') ||
      !noteInsertRequest
    ) {
      return
    }

    const { markdown, source, aiSessionId, seq } = noteInsertRequest
    const { clearNoteInsertRequest, setViewerStatus } = useWorkspaceStore.getState()

    void insertAiNoteEntry(markdown, source, aiSessionId)
      .then(() => {
        setViewerStatus({ detail: '已加入笔记' })
        window.setTimeout(() => {
          if (useWorkspaceStore.getState().viewerStatus?.detail === '已加入笔记') {
            setViewerStatus(null)
          }
        }, 2000)
      })
      .catch((err: Error) => {
        setViewerStatus({ detail: err.message || '加入笔记失败' })
      })
      .finally(() => {
        if (useWorkspaceStore.getState().noteInsertRequest?.seq === seq) {
          clearNoteInsertRequest()
        }
      })
  }, [noteInsertRequest, workbenchMode])
}
