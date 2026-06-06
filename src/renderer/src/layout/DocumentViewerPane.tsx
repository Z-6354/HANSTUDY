import type { OpenDocument } from '../stores/workspaceStore'
import { AnnotatedViewerShell } from '../annotations/AnnotationSurfaceContext'
import { SettingsPage } from '../settings/SettingsPage'
import { DocxViewer } from '../viewers/DocxViewer'
import { MdViewer } from '../viewers/MdViewer'
import { PdfViewer } from '../viewers/PdfViewer'
import { TxtViewer } from '../viewers/TxtViewer'
import { WebViewer } from '../viewers/WebViewer'

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
      <PdfViewer filePath={doc.path} />
    ) : doc.type === 'md' ? (
      <MdViewer filePath={doc.path} />
    ) : doc.type === 'txt' ? (
      <TxtViewer filePath={doc.path} />
    ) : doc.type === 'docx' ? (
      <DocxViewer filePath={doc.path} />
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
