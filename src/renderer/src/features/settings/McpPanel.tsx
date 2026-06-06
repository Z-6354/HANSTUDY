import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { McpServerState } from '@shared/mcp/types'
import { IconButton } from '../../components/IconButton'
import { useAppSettingsStore } from '../../stores/appSettingsStore'

export function McpPanel(): JSX.Element {
  const hitlAutoApprove = useAppSettingsStore((s) => s.hitlAutoApprove)
  const saveAppSettings = useAppSettingsStore((s) => s.saveSettings)
  const appSettingsLoaded = useAppSettingsStore((s) => s.loaded)
  const [servers, setServers] = useState<McpServerState[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      setServers(await window.api.mcp.list())
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 MCP 列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!appSettingsLoaded) {
      void useAppSettingsStore.getState().load()
    }
  }, [appSettingsLoaded])

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2 className="settings-section-title">MCP</h2>
        <IconButton icon={RefreshCw} label="刷新" onClick={() => void load()} />
      </div>
      <p className="settings-section-desc">
        配置文件位于 %APPDATA%/hanstudy-reader/mcp.json 或项目 .hanstudy/mcp.json
      </p>
      <label className="settings-checkbox-row">
        <input
          type="checkbox"
          checked={hitlAutoApprove}
          onChange={(e) => void saveAppSettings({ hitlAutoApprove: e.target.checked })}
        />
        自动批准 MCP 工具调用（跳过 HITL 确认弹窗）
      </label>
      {loading && <p className="settings-hint">加载中…</p>}
      {error && <p className="error-state">{error}</p>}
      {!loading && servers.length === 0 && (
        <p className="settings-hint">暂无 MCP 服务器，请编辑 mcp.json 添加 stdio 类型服务</p>
      )}
      <ul className="mcp-server-list">
        {servers.map((s) => (
          <li key={s.id} className="mcp-server-item">
            <div className="mcp-server-meta">
              <strong>{s.name}</strong>
              <span className={`mcp-status mcp-status--${s.status}`}>{s.status}</span>
              <span className="settings-hint">{s.toolCount} 个工具</span>
            </div>
            {s.lastError && <p className="error-state">{s.lastError}</p>}
            <div className="mcp-server-actions">
              <label>
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={(e) => void window.api.mcp.toggle(s.id, e.target.checked).then(setServers)}
                />
                启用
              </label>
              <button type="button" onClick={() => void window.api.mcp.restart(s.id).then(setServers)}>
                重启
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
