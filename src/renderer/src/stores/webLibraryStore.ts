import { create } from 'zustand'
import type {
  SaveWebCredentialInput,
  WebBookmark,
  WebCredentialItem,
  WebHistoryEntry,
  WebPhoneEntry
} from '../../../shared/webLibrary'

interface WebLibraryState {
  loaded: boolean
  history: WebHistoryEntry[]
  bookmarks: WebBookmark[]
  credentials: WebCredentialItem[]
  phones: WebPhoneEntry[]
  load: () => Promise<void>
  addHistory: (url: string, title: string) => Promise<void>
  removeHistory: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  addBookmark: (url: string, title: string) => Promise<void>
  removeBookmark: (id: string) => Promise<void>
  isBookmarked: (url: string) => Promise<boolean>
  saveCredential: (input: SaveWebCredentialInput) => Promise<void>
  removeCredential: (id: string) => Promise<void>
  getCredentialPassword: (id: string) => Promise<string>
  removePhone: (id: string) => Promise<void>
}

export const useWebLibraryStore = create<WebLibraryState>((set) => ({
  loaded: false,
  history: [],
  bookmarks: [],
  credentials: [],
  phones: [],

  load: async () => {
    const [history, bookmarks, credentials, phones] = await Promise.all([
      window.api.webLibrary.listHistory(),
      window.api.webLibrary.listBookmarks(),
      window.api.webLibrary.listCredentials(),
      window.api.webLibrary.listPhones()
    ])
    set({ loaded: true, history, bookmarks, credentials, phones })
    window.api.webLibrary.onPhonesChanged((nextPhones) => set({ phones: nextPhones }))
  },

  addHistory: async (url, title) => {
    const history = await window.api.webLibrary.addHistory(url, title)
    set({ history })
  },

  removeHistory: async (id) => {
    const history = await window.api.webLibrary.removeHistory(id)
    set({ history })
  },

  clearHistory: async () => {
    const history = await window.api.webLibrary.clearHistory()
    set({ history })
  },

  addBookmark: async (url, title) => {
    const bookmarks = await window.api.webLibrary.addBookmark(url, title)
    set({ bookmarks })
  },

  removeBookmark: async (id) => {
    const bookmarks = await window.api.webLibrary.removeBookmark(id)
    set({ bookmarks })
  },

  isBookmarked: (url) => window.api.webLibrary.isBookmarked(url),

  saveCredential: async (input) => {
    const credentials = await window.api.webLibrary.saveCredential(input)
    set({ credentials })
  },

  removeCredential: async (id) => {
    const credentials = await window.api.webLibrary.removeCredential(id)
    set({ credentials })
  },

  getCredentialPassword: (id) => window.api.webLibrary.getCredentialPassword(id),

  removePhone: async (id) => {
    const phones = await window.api.webLibrary.removePhone(id)
    set({ phones })
  }
}))
