import { useEffect } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'

export function useMaximizeLayout(): void {
  const enterMaximizeLayout = useWorkspaceStore((s) => s.enterMaximizeLayout)
  const exitMaximizeLayout = useWorkspaceStore((s) => s.exitMaximizeLayout)

  useEffect(() => {
    const apply = (maximized: boolean): void => {
      if (maximized) {
        enterMaximizeLayout()
      } else {
        exitMaximizeLayout()
      }
    }
    void window.api.window.isMaximized().then(apply)
    return window.api.window.onMaximizedChanged(apply)
  }, [enterMaximizeLayout, exitMaximizeLayout])
}
