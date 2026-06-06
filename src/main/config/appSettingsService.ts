import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings
} from '../../shared/appSettings'
import type { WebSearchEngine } from '../../shared/webCrop'

function settingsPath(): string {
  return join(app.getPath('userData'), 'app-settings.json')
}

function normalizeEngine(value: unknown): WebSearchEngine {
  if (value === 'bing' || value === 'baidu' || value === 'google') return value
  return DEFAULT_APP_SETTINGS.searchEngine
}

function normalizeBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeSettings(stored: Partial<AppSettings>): AppSettings {
  return {
    searchEngine: normalizeEngine(stored.searchEngine),
    webBrowseHideSidebar: normalizeBool(
      stored.webBrowseHideSidebar,
      DEFAULT_APP_SETTINGS.webBrowseHideSidebar
    ),
    webBrowseHideAIPanel: normalizeBool(
      stored.webBrowseHideAIPanel,
      DEFAULT_APP_SETTINGS.webBrowseHideAIPanel
    ),
    hitlAutoApprove: normalizeBool(stored.hitlAutoApprove, DEFAULT_APP_SETTINGS.hitlAutoApprove)
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const raw = await readFile(settingsPath(), 'utf-8')
    const stored = JSON.parse(raw) as Partial<AppSettings>
    return normalizeSettings(stored)
  } catch {
    return { ...DEFAULT_APP_SETTINGS }
  }
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const dir = app.getPath('userData')
  await mkdir(dir, { recursive: true })
  await writeFile(settingsPath(), JSON.stringify(normalizeSettings(settings), null, 2), 'utf-8')
}
