import { vi } from 'vitest'

const store = new Map<string, string>()

vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
  clear: () => store.clear(),
  get length() {
    return store.size
  },
  key: (index: number) => Array.from(store.keys())[index] ?? null
})

export function clearMockLocalStorage(): void {
  store.clear()
}
