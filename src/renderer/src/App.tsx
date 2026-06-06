import { useEffect, useLayoutEffect } from 'react'
import { Workbench } from './ui/layout/Workbench'
import { TitleBar } from './ui/layout/TitleBar'
import { useMaximizeLayout } from './hooks/useMaximizeLayout'
import { useWorkspaceSessionPersist } from './hooks/useWorkspaceSessionPersist'
import { useAppSettingsStore } from './stores/appSettingsStore'
import { useWebLibraryStore } from './stores/webLibraryStore'
import { useWorkspaceStore } from './stores/workspaceStore'

export default function App(): JSX.Element {
  const loadAppSettings = useAppSettingsStore((s) => s.load)
  const loadWebLibrary = useWebLibraryStore((s) => s.load)
  const focusMode = useWorkspaceStore((s) => s.focusMode)
  const toggleFocusMode = useWorkspaceStore((s) => s.toggleFocusMode)
  const exitFocusMode = useWorkspaceStore((s) => s.exitFocusMode)

  useWorkspaceSessionPersist()
  useMaximizeLayout()

  useEffect(() => {
    void loadAppSettings()
    void loadWebLibrary()
  }, [loadAppSettings, loadWebLibrary])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'F11') {
        e.preventDefault()
        toggleFocusMode()
        return
      }
      if (e.key === 'Escape' && useWorkspaceStore.getState().focusMode) {
        const target = e.target as HTMLElement
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
        e.preventDefault()
        exitFocusMode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFocusMode, exitFocusMode])

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
    return () => cancelAnimationFrame(id)
  }, [focusMode])

  return (
    <div className={`app-shell${focusMode ? ' app-shell--focus' : ''}`}>
      {!focusMode && <TitleBar />}
      <Workbench />
    </div>
  )
}
