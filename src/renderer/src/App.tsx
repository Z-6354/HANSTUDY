import { useEffect, useLayoutEffect } from 'react'
import { Workbench } from './ui/layout/Workbench'
import { TitleBar } from './ui/layout/TitleBar'
import { usePageZoomGuard } from './hooks/usePageZoomGuard'
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
  usePageZoomGuard()

  useEffect(() => {
    void loadAppSettings()
    void loadWebLibrary()
  }, [loadAppSettings, loadWebLibrary])

  /** 禁止 Ctrl/⌘+滚轮触发 Chromium 整页缩放；须保留传播，PDF/TXT viewer 仍需接收 */
  useEffect(() => {
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
    }
    document.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => document.removeEventListener('wheel', onWheel, { capture: true })
  }, [])

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
