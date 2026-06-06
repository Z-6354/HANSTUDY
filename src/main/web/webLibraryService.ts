import { app, safeStorage } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type {
  SaveWebCredentialInput,
  WebBookmark,
  WebCredentialItem,
  WebCredentialRecord,
  WebHistoryEntry,
  WebPhoneEntry
} from '../../shared/webLibrary'
import { WEB_HISTORY_MAX, WEB_PHONE_MAX, credentialsOriginMatch, isRecordableWebUrl, normalizePhoneNumber, webPageOrigin } from '../../shared/webLibrary'

const ENC_PREFIX = 'enc:'
const B64_PREFIX = 'b64:'

interface WebLibraryFile {
  history: WebHistoryEntry[]
  bookmarks: WebBookmark[]
  credentials: WebCredentialRecord[]
  phones?: WebPhoneEntry[]
}

function libraryPath(): string {
  return join(app.getPath('userData'), 'web-library.json')
}

function encryptSecret(value: string): string {
  const normalized = value.trim()
  if (!normalized) return ''
  if (safeStorage.isEncryptionAvailable()) {
    return ENC_PREFIX + safeStorage.encryptString(normalized).toString('base64')
  }
  return B64_PREFIX + Buffer.from(normalized, 'utf-8').toString('base64')
}

function decryptSecret(enc: string): string {
  if (!enc) return ''
  if (enc.startsWith(ENC_PREFIX)) {
    if (!safeStorage.isEncryptionAvailable()) return ''
    try {
      return safeStorage.decryptString(Buffer.from(enc.slice(ENC_PREFIX.length), 'base64'))
    } catch {
      return ''
    }
  }
  if (enc.startsWith(B64_PREFIX)) {
    try {
      return Buffer.from(enc.slice(B64_PREFIX.length), 'base64').toString('utf-8')
    } catch {
      return ''
    }
  }
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(enc, 'base64'))
    }
    return Buffer.from(enc, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

async function loadFile(): Promise<WebLibraryFile> {
  try {
    const raw = await readFile(libraryPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<WebLibraryFile>
    return {
      history: Array.isArray(parsed.history) ? parsed.history : [],
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      credentials: Array.isArray(parsed.credentials) ? parsed.credentials : [],
      phones: Array.isArray(parsed.phones) ? parsed.phones : []
    }
  } catch {
    return { history: [], bookmarks: [], credentials: [], phones: [] }
  }
}

async function saveFile(data: WebLibraryFile): Promise<void> {
  const dir = app.getPath('userData')
  await mkdir(dir, { recursive: true })
  await writeFile(libraryPath(), JSON.stringify(data, null, 2), 'utf-8')
}

function toCredentialItem(record: WebCredentialRecord): WebCredentialItem {
  return {
    id: record.id,
    origin: record.origin,
    username: record.username,
    label: record.label,
    updatedAt: record.updatedAt
  }
}

export async function listWebHistory(): Promise<WebHistoryEntry[]> {
  const data = await loadFile()
  return data.history
}

export async function addWebHistory(url: string, title: string): Promise<WebHistoryEntry[]> {
  if (!isRecordableWebUrl(url)) return (await loadFile()).history
  const data = await loadFile()
  const entry: WebHistoryEntry = {
    id: randomUUID(),
    url,
    title: title.trim() || url,
    visitedAt: new Date().toISOString()
  }
  data.history = [entry, ...data.history.filter((h) => h.url !== url)].slice(0, WEB_HISTORY_MAX)
  await saveFile(data)
  return data.history
}

export async function removeWebHistory(id: string): Promise<WebHistoryEntry[]> {
  const data = await loadFile()
  data.history = data.history.filter((h) => h.id !== id)
  await saveFile(data)
  return data.history
}

export async function clearWebHistory(): Promise<WebHistoryEntry[]> {
  const data = await loadFile()
  data.history = []
  await saveFile(data)
  return data.history
}

export async function listWebBookmarks(): Promise<WebBookmark[]> {
  return (await loadFile()).bookmarks
}

export async function addWebBookmark(url: string, title: string): Promise<WebBookmark[]> {
  if (!isRecordableWebUrl(url)) return (await loadFile()).bookmarks
  const data = await loadFile()
  const existing = data.bookmarks.find((b) => b.url === url)
  if (existing) {
    existing.title = title.trim() || existing.title
    await saveFile(data)
    return data.bookmarks
  }
  data.bookmarks.unshift({
    id: randomUUID(),
    url,
    title: title.trim() || url,
    createdAt: new Date().toISOString()
  })
  await saveFile(data)
  return data.bookmarks
}

export async function removeWebBookmark(id: string): Promise<WebBookmark[]> {
  const data = await loadFile()
  data.bookmarks = data.bookmarks.filter((b) => b.id !== id)
  await saveFile(data)
  return data.bookmarks
}

export async function isWebBookmarked(url: string): Promise<boolean> {
  if (!isRecordableWebUrl(url)) return false
  const data = await loadFile()
  return data.bookmarks.some((b) => b.url === url)
}

export async function listWebCredentials(): Promise<WebCredentialItem[]> {
  const data = await loadFile()
  return data.credentials.map(toCredentialItem)
}

export async function listWebCredentialsForOrigin(pageOrigin: string): Promise<WebCredentialItem[]> {
  const data = await loadFile()
  return data.credentials
    .filter((c) => credentialsOriginMatch(c.origin, pageOrigin))
    .map(toCredentialItem)
}

export async function saveWebCredential(input: SaveWebCredentialInput): Promise<WebCredentialItem[]> {
  const origin = webPageOrigin(input.origin) || input.origin.trim()
  const username = input.username.trim()
  if (!origin || !username) return listWebCredentials()

  const data = await loadFile()
  const now = new Date().toISOString()
  const passwordEnc = encryptSecret(input.password)

  if (input.id) {
    const idx = data.credentials.findIndex((c) => c.id === input.id)
    if (idx >= 0) {
      const prev = data.credentials[idx]
      data.credentials[idx] = {
        ...prev,
        origin,
        username,
        passwordEnc: passwordEnc || prev.passwordEnc,
        label: input.label?.trim() || undefined,
        updatedAt: now
      }
    }
  } else {
    const dup = data.credentials.findIndex(
      (c) => c.origin === origin && c.username === username
    )
    if (dup >= 0) {
      const prev = data.credentials[dup]
      data.credentials[dup] = {
        ...prev,
        passwordEnc: passwordEnc || prev.passwordEnc,
        label: input.label?.trim() || prev.label,
        updatedAt: now
      }
    } else {
      data.credentials.unshift({
        id: randomUUID(),
        origin,
        username,
        passwordEnc,
        label: input.label?.trim() || undefined,
        updatedAt: now
      })
    }
  }

  await saveFile(data)
  return data.credentials.map(toCredentialItem)
}

export async function removeWebCredential(id: string): Promise<WebCredentialItem[]> {
  const data = await loadFile()
  data.credentials = data.credentials.filter((c) => c.id !== id)
  await saveFile(data)
  return data.credentials.map(toCredentialItem)
}

export async function getWebCredentialPassword(id: string): Promise<string> {
  const data = await loadFile()
  const record = data.credentials.find((c) => c.id === id)
  if (!record) return ''
  return decryptSecret(record.passwordEnc)
}

export async function listWebPhones(): Promise<WebPhoneEntry[]> {
  const data = await loadFile()
  return data.phones ?? []
}

export async function addWebPhone(phone: string, origin?: string): Promise<WebPhoneEntry[]> {
  const normalized = normalizePhoneNumber(phone)
  if (!normalized) return listWebPhones()

  const data = await loadFile()
  if (!data.phones) data.phones = []
  const now = new Date().toISOString()
  const siteOrigin = origin?.trim() ? webPageOrigin(origin) || origin.trim() : undefined
  const existingIdx = data.phones.findIndex((p) => p.phone === normalized)

  if (existingIdx >= 0) {
    const prev = data.phones[existingIdx]
    data.phones.splice(existingIdx, 1)
    data.phones.unshift({
      ...prev,
      origin: siteOrigin || prev.origin,
      updatedAt: now
    })
  } else {
    data.phones.unshift({
      id: randomUUID(),
      phone: normalized,
      origin: siteOrigin,
      updatedAt: now
    })
  }

  data.phones = data.phones.slice(0, WEB_PHONE_MAX)
  await saveFile(data)
  return data.phones
}

export async function removeWebPhone(id: string): Promise<WebPhoneEntry[]> {
  const data = await loadFile()
  if (!data.phones) data.phones = []
  data.phones = data.phones.filter((p) => p.id !== id)
  await saveFile(data)
  return data.phones
}
