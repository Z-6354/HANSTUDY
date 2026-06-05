import type { OpenDocument } from '../stores/workspaceStore'
import { AnnotatedViewerShell } from '../annotations/AnnotationSurfaceContext'
import { SettingsPage } from '../settings/SettingsPage'
import { DocxViewer } from '../viewers/DocxViewer'
import { MdViewer } from '../viewers/MdViewer'
import { PdfViewer } from '../viewers/PdfViewer'
import { TxtViewer } from '../viewers/TxtViewer'

interface DocumentViewerPaneProps {
  doc: OpenDocument
  isActive: boolean
}

export function DocumentViewerPane({ doc, isActive }: DocumentViewerPaneProps): JSX.Element {
  const viewer =
    doc.type === 'md' ? (
      <MdViewer filePath={doc.path} />
    ) : doc.type === 'txt' ? (
      <TxtViewer filePath={doc.path} />
    ) : doc.type === 'pdf' ? (
      <PdfViewer filePath={doc.path} />
    ) : doc.type === 'docx' ? (
      <DocxViewer filePath={doc.path} />
    ) : (
      <div className="error-state">不支持的文件格式：{doc.name}</div>
    )

  return (
    <div className={`viewer-pane ${isActive ? 'active' : ''}`} aria-hidden={!isActive}>
      {doc.type === 'settings' ? (
        <SettingsPage />
      ) : (
        <AnnotatedViewerShell docPath={doc.path} isActive={isActive}>
          {viewer}
        </AnnotatedViewerShell>
      )}
    </div>
  )
}
