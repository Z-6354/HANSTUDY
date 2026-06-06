import { useEffect, useRef } from 'react'
import { clearDomFind, runDomFind } from './domFind'
import { useWorkspaceStore } from '../../../stores/workspaceStore'

export function useDomFind(root: HTMLElement | null, enabled: boolean): void {
  const findQuery = useWorkspaceStore((s) => s.findQuery)
  const findStepSeq = useWorkspaceStore((s) => s.findStepSeq)
  const findStepForward = useWorkspaceStore((s) => s.findStepForward)
  const findBarOpen = useWorkspaceStore((s) => s.findBarOpen)
  const setFindMatchStats = useWorkspaceStore((s) => s.setFindMatchStats)
  const indexRef = useRef(-1)

  useEffect(() => {
    indexRef.current = -1
  }, [findQuery])

  useEffect(() => {
    if (!enabled || !findBarOpen) {
      clearDomFind(root)
      indexRef.current = -1
      return
    }
    if (!findQuery.trim()) {
      clearDomFind(root)
      setFindMatchStats(0, 0)
      indexRef.current = -1
      return
    }
    const result = runDomFind(root, findQuery, indexRef.current, findStepForward)
    indexRef.current = result.index
    setFindMatchStats(result.index, result.count)
  }, [enabled, findBarOpen, findQuery, findStepForward, findStepSeq, root, setFindMatchStats])

  useEffect(() => {
    if (!findBarOpen) clearDomFind(root)
  }, [findBarOpen, root])
}
