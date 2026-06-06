import { useEffect, useRef } from 'react'
import { useWorkspaceStore, type ViewerCommandKind } from '../../../stores/workspaceStore'

export function useViewerCommand(
  isActive: boolean,
  kind: ViewerCommandKind,
  handler: () => void
): void {
  const viewerCommand = useWorkspaceStore((s) => s.viewerCommand)
  const lastSeqRef = useRef(0)

  useEffect(() => {
    if (!isActive || !viewerCommand || viewerCommand.kind !== kind) return
    if (viewerCommand.seq === lastSeqRef.current) return
    lastSeqRef.current = viewerCommand.seq
    handler()
  }, [handler, isActive, kind, viewerCommand])
}
