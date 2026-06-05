import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import {
  AI_PROVIDERS,
  DEFAULT_PROVIDER_ID,
  getModelMeta,
  getProviderById,
  inferProviderId
} from '../../../shared/aiProviders'
import { IconButton } from '../components/IconButton'
import type { AISettings } from '../types/global.d'

function buildDefaults(): AISettings {
  const provider = getProviderById(DEFAULT_PROVIDER_ID)!
  return {
    provider: provider.id,
    baseUrl: provider.baseUrl,
    model: provider.defaultModel,
    apiKey: ''
  }
}

export function SystemConfigPanel(): JSX.Element {
  const [settings, setSettings] = useState<AISettings>(buildDefaults)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [hasStoredKey, setHasStoredKey] = useState(false)
  const [keyNeedsReenter, setKeyNeedsReenter] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const provider = getProviderById(settings.provider)
  const isCustom = settings.provider === 'custom'
  const manualModel = isCustom || provider?.manualModel
  const selectedModelMeta =
    provider?.models.find((m) => m.id === settings.model) ?? getModelMeta(settings.model)

  useEffect(() => {
    void (async () => {
      const [masked, raw] = await Promise.all([
        window.api.settings.get(),
        window.api.settings.getRaw()
      ])
      setSettings({
        ...masked,
        provider: masked.provider || inferProviderId(masked.baseUrl),
        apiKey: ''
      })
      const stored = Boolean(masked.apiKey)
      setHasStoredKey(stored)
      setKeyNeedsReenter(stored && !raw.apiKey.trim())
      setApiKeyInput('')
    })()
  }, [])

  const handleProviderChange = (providerId: string): void => {
    const next = getProviderById(providerId)
    if (!next) return
    setSettings({
      ...settings,
      provider: providerId,
      baseUrl: next.baseUrl,
      model: next.defaultModel,
      enableThinking: getModelMeta(next.defaultModel)?.defaultThinking
    })
  }

  const applyPresetModel = (modelId: string): void => {
    const meta = provider?.models.find((m) => m.id === modelId) ?? getModelMeta(modelId)
    setSettings({
      ...settings,
      model: modelId,
      enableThinking: meta?.defaultThinking
    })
  }

  const handleSave = async (): Promise<void> => {
    if (!settings.model.trim()) {
      setMessage('请填写模型名称')
      return
    }

    const nextKey = apiKeyInput.trim() || (hasStoredKey && !keyNeedsReenter ? '********' : '')
    if (!nextKey) {
      setMessage('请填写 API 密钥')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      await window.api.settings.save({ ...settings, apiKey: nextKey })
      setHasStoredKey(true)
      setKeyNeedsReenter(false)
      setApiKeyInput('')
      setMessage('已保存')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-section">
      <h2 className="settings-section-title">系统配置</h2>
      <p className="settings-section-desc">配置 AI 模型供应商、接口地址与 API 密钥。</p>

      <div className="settings-form">
        <label>
          供应商
          <select
            value={settings.provider}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          模型
          {manualModel ? (
            <>
              <input
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                placeholder={
                  settings.provider === 'volcengine'
                    ? 'ep-xxxx 或 deepseek-v4-flash'
                    : '例如 deepseek-v4-flash、MiniMax-M2.7'
                }
              />
              {provider && provider.models.length > 0 && (
                <div className="model-presets">
                  <span className="settings-hint">快捷选择：</span>
                  {provider.models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`preset-chip ${settings.model === m.id ? 'active' : ''}`}
                      onClick={() => applyPresetModel(m.id)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <select
              value={settings.model}
              onChange={(e) => {
                const modelId = e.target.value
                const meta = provider?.models.find((m) => m.id === modelId)
                setSettings({
                  ...settings,
                  model: modelId,
                  enableThinking: meta?.defaultThinking
                })
              }}
            >
              {provider?.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </label>

        {selectedModelMeta?.description && (
          <p className="settings-hint model-desc">{selectedModelMeta.description}</p>
        )}

        {selectedModelMeta?.supportsThinking && (
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={settings.enableThinking ?? selectedModelMeta.defaultThinking ?? false}
              onChange={(e) => setSettings({ ...settings, enableThinking: e.target.checked })}
            />
            开启深度思考（thinking）
          </label>
        )}

        {isCustom && (
          <label>
            API 地址
            <input
              value={settings.baseUrl}
              onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
              placeholder="https://api.deepseek.com/v1"
            />
          </label>
        )}

        <label>
          API 密钥
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={
              hasStoredKey && !keyNeedsReenter
                ? '已保存，留空则不修改'
                : '请填写密钥（无需加 Bearer 前缀）'
            }
          />
        </label>

        {keyNeedsReenter && (
          <p className="settings-msg settings-warn">
            本地密钥无法解密（可能因系统加密环境变化）。请重新填写 API 密钥并保存。
          </p>
        )}

        {!isCustom && <p className="settings-hint">接口：{settings.baseUrl}</p>}
        {provider?.apiKeyHint && <p className="settings-hint">{provider.apiKeyHint}</p>}
        <p className="settings-hint">密钥仅保存在本机，经系统加密存储。</p>

        {message && (
          <p className={`settings-msg ${message.includes('请') || message.includes('失败') ? 'settings-warn' : ''}`}>
            {message}
          </p>
        )}

        <div className="settings-form-actions">
          <IconButton
            icon={Save}
            label={saving ? '保存中...' : '保存配置'}
            className="primary-btn icon-action-btn"
            disabled={saving}
            onClick={() => void handleSave()}
          />
        </div>
      </div>
    </div>
  )
}
