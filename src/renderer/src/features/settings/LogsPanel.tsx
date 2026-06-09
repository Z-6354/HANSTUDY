import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, RefreshCw } from 'lucide-react'
import type { AuditEntry } from '@shared/auditLog'
import type { AppLogInfo } from '@shared/appLog'
import { IconButton } from '../../components/IconButton'

const OUTCOME_LABEL: Record<AuditEntry['outcome'], string> = {
  allow: '允许',
  deny: '拒绝',
  error: '错误'
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function LogsPanel(): JSX.Element {
  const [info, setInfo] = useState<AppLogInfo | null>(null)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [appLogLines, setAppLogLines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    setMessage('')
    try {
      const [logInfo, recent, logLines] = await Promise.all([
        window.api.logs.getInfo(),
        window.api.logs.readAuditRecent(50),
        window.api.logs.readAppLogRecent(40)
      ])
      setInfo(logInfo)
      setEntries(recent.slice().reverse())
      setAppLogLines(logLines)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '加载日志失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openDir = async (which: 'logs' | 'audit'): Promise<void> => {
    setMessage('')
    try {
      const result = await window.api.logs.openDir(which)
      if (!result.ok) setMessage('无法打开目录（请确认工作区路径可写）')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '打开目录失败')
    }
  }

  return (
    <div className="settings-section">
      <h2 className="settings-section-title">日志</h2>
      <p className="settings-section-desc">
        运行日志与工具审计日志保存在工作区根目录下的 logs/ 与 audit/ 文件夹（按本地日历日分文件）。
      </p>

      <div className="skill-panel-actions">
        <IconButton icon={RefreshCw} label="刷新" onClick={() => void refresh()} disabled={loading} />
      </div>

      {info && (
        <div className="logs-path-grid">
          <div className="logs-path-card">
            <div className="logs-path-label">运行日志</div>
            <code className="logs-path-value">{info.currentLogFile}</code>
            <button type="button" className="secondary-btn" onClick={() => void openDir('logs')}>
              <FolderOpen size={14} />
              打开 logs 目录
            </button>
          </div>
          <div className="logs-path-card">
            <div className="logs-path-label">审计日志（JSONL）</div>
            <code className="logs-path-value">{info.currentAuditFile}</code>
            <button type="button" className="secondary-btn" onClick={() => void openDir('audit')}>
              <FolderOpen size={14} />
              打开 audit 目录
            </button>
          </div>
        </div>
      )}

      {message && <p className="settings-msg settings-warn">{message}</p>}

      <h3 className="settings-section-title settings-section-title-spaced">今日运行日志（最近 40 行）</h3>
      {loading ? (
        <p className="settings-hint">加载中…</p>
      ) : appLogLines.length === 0 ? (
        <p className="settings-hint">暂无运行日志（启动应用并操作后会写入）</p>
      ) : (
        <pre className="logs-app-tail">{appLogLines.join('\n')}</pre>
      )}

      <h3 className="settings-section-title settings-section-title-spaced">今日工具审计（最近 50 条）</h3>
      {loading ? (
        <p className="settings-hint">加载中…</p>
      ) : entries.length === 0 ? (
        <p className="settings-hint">暂无审计记录（Agent 调用工具后会写入）</p>
      ) : (
        <div className="logs-audit-table-wrap">
          <table className="logs-audit-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>工具</th>
                <th>结果</th>
                <th>耗时</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={`${entry.timestamp}-${entry.tool}-${idx}`}>
                  <td>{formatTime(entry.timestamp)}</td>
                  <td>{entry.tool}</td>
                  <td>
                    <span className={`logs-outcome logs-outcome-${entry.outcome}`}>
                      {OUTCOME_LABEL[entry.outcome]}
                    </span>
                  </td>
                  <td>{entry.durationMs}ms</td>
                  <td className="logs-reason-cell" title={entry.reason ?? undefined}>
                    {entry.reason ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
