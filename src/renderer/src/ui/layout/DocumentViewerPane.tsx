import type { OpenDocument } from '../../stores/workspaceStore'
import { AnnotatedViewerShell } from '../../features/reader/annotations/AnnotationSurfaceContext'
import { SettingsPage } from '../../features/settings/SettingsPage'
import { DocxViewer } from '../../features/reader/viewers/DocxViewer'
import { MdViewer } from '../../features/reader/viewers/MdViewer'
import { PdfViewer } from '../../features/reader/viewers/PdfViewer'
import { TxtViewer } from '../../features/reader/viewers/TxtViewer'
import { WebViewer } from '../../features/reader/viewers/WebViewer'

interface DocumentViewerPaneProps {
  doc: OpenDocument
  isActive: boolean
}

export function DocumentViewerPane({ doc, isActive }: DocumentViewerPaneProps): JSX.Element {
  if (doc.type === 'settings') {
    return (
      <div className={`viewer-pane ${isActive ? 'active' : ''}`} aria-hidden={!isActive}>
        <SettingsPage />
      </div>
    )
  }

  if (doc.type === 'web') {
    return (
      <div className={`viewer-pane web-pane ${isActive ? 'active' : ''}`} aria-hidden={!isActive}>
        <WebViewer url={doc.path} docId={doc.id} isActive={isActive} />
      </div>
    )
  }

  const viewer =
    doc.type === 'web-snapshot' || doc.type === 'pdf' ? (
      <PdfViewer filePath={doc.path} isActive={isActive} />
    ) : doc.type === 'md' ? (
      <MdViewer filePath={doc.path} isActive={isActive} />
    ) : doc.type === 'txt' ? (
      <TxtViewer filePath={doc.path} isActive={isActive} />
    ) : doc.type === 'docx' ? (
      <DocxViewer filePath={doc.path} isActive={isActive} />
    ) : (
      <div className="error-state">不支持的文件格式：{doc.name}</div>
    )

  return (
    <div className={`viewer-pane ${isActive ? 'active' : ''}`} aria-hidden={!isActive}>
      <AnnotatedViewerShell docPath={doc.path} isActive={isActive}>
        {viewer}
      </AnnotatedViewerShell>
    </div>
  )
}
