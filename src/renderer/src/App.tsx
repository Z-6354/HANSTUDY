import { useEffect } from 'react'
import { Workbench } from './layout/Workbench'
import { TitleBar } from './layout/TitleBar'
import { useAppSettingsStore } from './stores/appSettingsStore'
import { useWebLibraryStore } from './stores/webLibraryStore'

export default function App(): JSX.Element {
  const loadAppSettings = useAppSettingsStore((s) => s.load)
  const loadWebLibrary = useWebLibraryStore((s) => s.load)

  useEffect(() => {
    void loadAppSettings()
    void loadWebLibrary()
  }, [loadAppSettings, loadWebLibrary])

  return (
    <div className="app-shell">
      <TitleBar />
      <Workbench />
    </div>
  )
}
