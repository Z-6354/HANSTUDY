import { useCallback, useEffect } from 'react'
import { Allotment } from 'allotment'
import { FilePlus, FolderOpen } from 'lucide-react'
import { IconButton } from '../../components/IconButton'
import { NoteEditor } from '../../features/notes/NoteEditor'
import { DocumentFindBar } from '../../features/reader/find/DocumentFindBar'
import { useWorkspaceStore, SETTINGS_DOC_PATH } from '../../stores/workspaceStore'
import { DocumentViewerPane } from './DocumentViewerPane'
import { GlobalSearchBar } from './GlobalSearchBar'
import { TabBar } from './TabBar'

export function EditorArea(): JSX.Element {
  const {
    documents,
    activeDocumentId,
    openDocument,
    closeDocument,
    setActiveDocument,
    showTabBar,
    workbenchMode,
    activeNotePath
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

  const viewerPanes =
    documents.length === 0 ? (
      <div className="empty-state">
        <h2>欢迎使用 HAN Study Reader</h2>
        <p>打开文档阅读，或在侧栏「笔记」中记笔记</p>
        <p className="empty-state-hint">记笔记模式下，左侧编辑笔记、右侧参考文档</p>
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
    ) : (
      <>
        {documents.map((doc) => (
          <DocumentViewerPane key={doc.id} doc={doc} isActive={doc.id === activeDocumentId} />
        ))}
        {!activeDoc && (
          <div className="empty-state">
            <p>请选择一个标签页</p>
          </div>
        )}
      </>
    )

  const referencePane = (
    <div className="viewer-container viewer-container-reference">{viewerPanes}</div>
  )

  const browsePane = <div className="viewer-container">{viewerPanes}</div>

  return (
    <div className="editor-area">
      <GlobalSearchBar />
      <DocumentFindBar />
      {showTabBar && <TabBar onOpenFile={() => void handleOpenFile()} />}

      {workbenchMode === 'compose' ? (
        <Allotment className="compose-split">
          <Allotment.Pane preferredSize="45%" minSize={240}>
            <div className="compose-note-pane">
              <NoteEditor filePath={activeNotePath} />
            </div>
          </Allotment.Pane>
          <Allotment.Pane minSize={280}>
            {referencePane}
          </Allotment.Pane>
        </Allotment>
      ) : (
        browsePane
      )}
    </div>
  )
}
