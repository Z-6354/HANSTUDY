import { create } from 'zustand'
import type { AppSettings } from '@shared/appSettings'
import { DEFAULT_APP_SETTINGS } from '@shared/appSettings'
import type { WebSearchEngine } from '@shared/webCrop'

interface AppSettingsState extends AppSettings {
  loaded: boolean
  load: () => Promise<void>
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>
  setSearchEngine: (engine: WebSearchEngine) => Promise<void>
}

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  ...DEFAULT_APP_SETTINGS,
  loaded: false,

  load: async () => {
    const settings = await window.api.appSettings.get()
    set({ ...settings, loaded: true })
  },

  saveSettings: async (patch) => {
    const next: AppSettings = { ...get(), ...patch }
    await window.api.appSettings.save(next)
    set(patch)
  },

  setSearchEngine: async (engine) => {
    await get().saveSettings({ searchEngine: engine })
  }
}))

/** 供非 React 代码读取当前搜索引擎 */
export function getSearchEngine(): WebSearchEngine {
  const { loaded, searchEngine } = useAppSettingsStore.getState()
  return loaded ? searchEngine : DEFAULT_APP_SETTINGS.searchEngine
}

/** 打开网页时是否自动收起侧�?AI（未加载设置前用默认值） */
export function getWebBrowseLayoutPrefs(): Pick<
  AppSettings,
  'webBrowseHideSidebar' | 'webBrowseHideAIPanel'
> {
  const state = useAppSettingsStore.getState()
  if (!state.loaded) {
    return {
      webBrowseHideSidebar: DEFAULT_APP_SETTINGS.webBrowseHideSidebar,
      webBrowseHideAIPanel: DEFAULT_APP_SETTINGS.webBrowseHideAIPanel
    }
  }
  return {
    webBrowseHideSidebar: state.webBrowseHideSidebar,
    webBrowseHideAIPanel: state.webBrowseHideAIPanel
  }
}
