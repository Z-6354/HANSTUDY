import { useEffect, useRef } from 'react'
import type { DocumentNoteAnchor } from '@shared/documentNotes'
import { useWorkspaceStore } from '../../../stores/workspaceStore'

export function useReaderNavigate(
  isActive: boolean,
  handler: (anchor: DocumentNoteAnchor) => void
): void {
  const readerNavigate = useWorkspaceStore((s) => s.readerNavigate)
  const lastSeqRef = useRef(0)
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!isActive || !readerNavigate) return
    if (readerNavigate.seq === lastSeqRef.current) return
    lastSeqRef.current = readerNavigate.seq
    handlerRef.current(readerNavigate.anchor)
  }, [isActive, readerNavigate])
}
