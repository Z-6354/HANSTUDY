import { useState, type ReactNode, type Ref } from 'react'
import { PdfSideHover } from './PdfSideHover'
import { TextOutlinePanel } from './TextOutlinePanel'
import type { TextOutlineItem } from './textOutline'

interface TextDocumentShellProps {
  outlineItems: TextOutlineItem[]
  currentLine: number
  currentChapter?: number
  onNavigateLine: (line: number) => void
  onNavigateChapter?: (chapterIndex: number) => void
  showOutlineLineNumbers?: boolean
  /** 侧栏展开前同步调用（如刷新 TXT 缩放） */
  onSidePanelHoverStart?: () => void
  renderThumbPanel?: (open: boolean) => ReactNode
  toolbar: ReactNode
  saveHint?: ReactNode
  headerActions?: ReactNode
  contentRef?: Ref<HTMLDivElement>
  children: ReactNode
}

export function TextDocumentShell({
  outlineItems,
  currentLine,
  currentChapter,
  onNavigateLine,
  onNavigateChapter,
  showOutlineLineNumbers = true,
  onSidePanelHoverStart,
  renderThumbPanel,
  toolbar,
  saveHint,
  headerActions,
  contentRef,
  children
}: TextDocumentShellProps): JSX.Element {
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [thumbOpen, setThumbOpen] = useState(false)

  return (
    <div className="text-doc-wrapper">
      <div className="text-doc-toolbar-row">
        {toolbar}
        <div className="text-doc-header-actions">
          {headerActions}
          {saveHint}
        </div>
      </div>
      <div className="text-doc-shell">
        <PdfSideHover
          side="left"
          open={outlineOpen}
          setOpen={setOutlineOpen}
          onHoverStart={onSidePanelHoverStart}
          label="目录"
        >
          <TextOutlinePanel
            items={outlineItems}
            currentLine={currentLine}
            currentChapter={currentChapter}
            onNavigate={onNavigateLine}
            onNavigateChapter={onNavigateChapter}
            showLineNumbers={showOutlineLineNumbers}
          />
        </PdfSideHover>

        <div ref={contentRef} className="text-doc-content">{children}</div>

        {renderThumbPanel && (
          <PdfSideHover
            side="right"
            open={thumbOpen}
            setOpen={setThumbOpen}
            onHoverStart={onSidePanelHoverStart}
            label="章节"
          >
            {renderThumbPanel(thumbOpen)}
          </PdfSideHover>
        )}
      </div>
    </div>
  )
}
