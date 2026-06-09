import { describe, expect, it } from 'vitest'
import { DEFAULT_APP_SETTINGS } from '../src/shared/appSettings'
import { normalizeSettings } from '../src/main/config/appSettingsService'

describe('normalizeSettings workspaceRoot', () => {
  it('defaults to null when missing', () => {
    expect(normalizeSettings({}).workspaceRoot).toBeNull()
  })

  it('trims and rejects empty string', () => {
    expect(normalizeSettings({ workspaceRoot: '  D:\\proj  ' }).workspaceRoot).toBe('D:\\proj')
    expect(normalizeSettings({ workspaceRoot: '   ' }).workspaceRoot).toBeNull()
  })

  it('migrates legacy projectRoot field', () => {
    expect(normalizeSettings({ projectRoot: 'E:\\legacy' }).workspaceRoot).toBe('E:\\legacy')
  })

  it('preserves other defaults', () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_APP_SETTINGS)
  })
})
