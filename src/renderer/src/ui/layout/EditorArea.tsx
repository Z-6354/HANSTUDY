import { useCallback, useEffect } from 'react'
import { Allotment } from 'allotment'
import { FilePlus, FolderOpen } from 'lucide-react'
import { IconButton } from '../../components/IconButton'
import { DocumentNotePanel } from '../../features/notes/DocumentNotePanel'
import { DocumentFindBar } from '../../features/reader/find/DocumentFindBar'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import type { WorkbenchMode } from '@shared/types'
import { DocumentViewerPane } from './DocumentViewerPane'
import { GlobalSearchBar } from './GlobalSearchBar'
import { TabBar } from './TabBar'
import { WorkbenchModeBar } from './WorkbenchModeBar'

export function EditorArea(): JSX.Element {
  const {
    documents,
    activeDocumentId,
    openDocument,
    closeDocument,
    setActiveDocument,
    showTabBar,
    workbenchMode,
  } = useWorkspaceStore()

  const activeDoc = documents.find((d) => d.id === activeDocumentId)

  const handleOpenFile = useCallback(async (): Promise<void> => {
    const result = await window.api.dialog.openFile()
    if (result) openDocument(result)
  }, [openDocument])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault()
        if (activeDocumentId) closeDocument(activeDocumentId)
        return
      }
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        if (documents.length < 2) return
        let idx = documents.findIndex((d) => d.id === activeDocumentId)
        if (idx < 0) idx = 0
        const nextIdx = e.shiftKey
          ? (idx - 1 + documents.length) % documents.length
          : (idx + 1) % documents.length
        setActiveDocument(documents[nextIdx].id)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeDocumentId, closeDocument, documents, setActiveDocument])

  const renderViewerPanes = (slot: WorkbenchMode): JSX.Element => {
    const slotVisible = workbenchMode === slot
    if (documents.length === 0) {
      return (
        <div className="empty-state">
          <h2>欢迎使用 HAN Study Reader</h2>
          <p>打开文档阅读，或在侧栏「笔记」中记笔记</p>
          <p className="empty-state-hint">
            {workbenchMode === 'compose'
              ? '笔记模式：左侧阅读文档，右侧笔记本可汇集多份文档的笔记'
              : '浏览模式：全屏阅读文档；切换到笔记模式可边读边记'}
          </p>
          <div className="actions actions-icon-row">
            <IconButton
              icon={FilePlus}
              label="打开文件"
              size={20}
              className="empty-action-btn"
              onClick={() => void handleOpenFile()}
            />
            <IconButton
              icon={FolderOpen}
              label="打开文件夹"
              size={20}
              className="empty-action-btn"
              onClick={async () => {
                const result = await window.api.dialog.openFolder()
                if (result) {
                  useWorkspaceStore.getState().setRootFolder(result.path, result.files)
                }
              }}
            />
          </div>
        </div>
      )
    }

    return (
      <>
        {documents.map((doc) => (
          <DocumentViewerPane
            key={slot === 'compose' ? `compose:${doc.id}` : doc.id}
            doc={doc}
            viewerSlot={slot}
            isActive={slotVisible && doc.id === activeDocumentId}
          />
        ))}
        {!activeDoc && (
          <div className="empty-state">
            <p>请选择一个标签页</p>
          </div>
        )}
      </>
    )
  }

  const isCompose = workbenchMode === 'compose'

  return (
    <div className="editor-area">
      <GlobalSearchBar />
      <DocumentFindBar />
      <WorkbenchModeBar />
      {showTabBar && <TabBar onOpenFile={() => void handleOpenFile()} />}

      {/* 浏览 / 笔记两模式始终挂载；笔记列 hidden 时不占宽，内容保留在内存 */}
      <Allotment className="workbench-split">
        <Allotment.Pane minSize={280}>
          <div className="viewer-slot-stack">
            <div
              className={`viewer-slot viewer-slot-browse${workbenchMode === 'browse' ? ' active' : ''}`}
            >
              <div className="viewer-container">{renderViewerPanes('browse')}</div>
            </div>
            <div
              className={`viewer-slot viewer-slot-compose${isCompose ? ' active' : ''}`}
            >
              <div className="viewer-container">{renderViewerPanes('compose')}</div>
            </div>
          </div>
        </Allotment.Pane>
        <Allotment.Pane visible={isCompose} preferredSize="45%" minSize={240}>
          <div className="compose-note-pane">
            <DocumentNotePanel doc={activeDoc ?? null} />
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  )
}
