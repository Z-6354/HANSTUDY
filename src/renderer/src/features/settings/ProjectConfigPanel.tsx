import { useEffect, useState } from 'react'
import { FolderOpen, RotateCcw } from 'lucide-react'
import type { AppEnvironmentInfo } from '@shared/appEnvironment'
import { AGENT_WORKSPACE_DIR, HANSTUDY_CONFIG_DIR, KNOWLEDGE_LIBRARY_DIR } from '@shared/workspaceLayoutConstants'
import { IconButton } from '../../components/IconButton'
import { useAppSettingsStore } from '../../stores/appSettingsStore'

export function ProjectConfigPanel(): JSX.Element {
  const workspaceRootSetting = useAppSettingsStore((s) => s.workspaceRoot)
  const loaded = useAppSettingsStore((s) => s.loaded)
  const saveSettings = useAppSettingsStore((s) => s.saveSettings)
  const [appEnv, setAppEnv] = useState<AppEnvironmentInfo | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loaded) {
      void useAppSettingsStore.getState().load()
    }
  }, [loaded])

  useEffect(() => {
    void window.api.app.getEnvironment().then(setAppEnv)
  }, [workspaceRootSetting, loaded])

  const projectRoot = appEnv?.workspaceRoot ?? ''
  const agentPath = appEnv?.agentWorkspacePath ?? ''
  const libraryPath = appEnv?.localLibraryPath ?? ''
  const defaultPath = appEnv?.defaultWorkspaceRoot ?? ''
  const isCustom = appEnv?.workspaceRootIsCustom ?? Boolean(workspaceRootSetting)

  const handleBrowse = async (): Promise<void> => {
    setMessage('')
    setBusy(true)
    try {
      const result = await window.api.dialog.openFolder()
      if (!result) return
      await saveSettings({ workspaceRoot: result.path })
      setMessage('项目根目录已更新')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '选择目录失败')
    } finally {
      setBusy(false)
    }
  }

  const handleResetDefault = async (): Promise<void> => {
    if (!isCustom) return
    const ok = window.confirm(
      `恢复为默认项目根目录？\n\n默认路径：\n${defaultPath || '（应用安装目录）'}`
    )
    if (!ok) return

    setMessage('')
    setBusy(true)
    try {
      await saveSettings({ workspaceRoot: null })
      setMessage('已恢复默认项目根目录')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '恢复失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-section">
      <h2 className="settings-section-title">项目</h2>
      <p className="settings-section-desc">
        HanStudy 项目根目录默认位于应用安装位置。Agent 可读范围包括：项目根下{' '}
        <code>{AGENT_WORKSPACE_DIR}/</code>（含知识库 <code>{KNOWLEDGE_LIBRARY_DIR}/</code>）、
        <code>{HANSTUDY_CONFIG_DIR}/</code>，以及资源管理器中打开的文件夹。
      </p>

      <div className="settings-form">
        <label>
          项目根目录
          <input type="text" readOnly value={projectRoot} placeholder="加载中…" />
        </label>
      </div>

      {defaultPath && (
        <p className="settings-hint">
          默认路径：<code>{defaultPath}</code>
          {isCustom ? '（当前为自定义）' : '（当前使用中）'}
        </p>
      )}

      <div className="skill-panel-actions">
        <IconButton
          icon={FolderOpen}
          label="选择目录"
          onClick={() => void handleBrowse()}
          disabled={busy}
        />
        {isCustom && (
          <IconButton
            icon={RotateCcw}
            label="恢复默认"
            onClick={() => void handleResetDefault()}
            disabled={busy}
          />
        )}
      </div>

      {projectRoot && (
        <>
          <p className="settings-hint">
            Agent 固定可读：<code>{agentPath}</code>、<code>{projectRoot}\{HANSTUDY_CONFIG_DIR}</code>
          </p>
          <p className="settings-hint">
            知识库：<code>{libraryPath}</code>
          </p>
          <p className="settings-hint">
            项目 Skill：<code>{projectRoot}\.hanstudy\skills</code>
          </p>
          <p className="settings-hint">
            项目 MCP：<code>{projectRoot}\.hanstudy\mcp.json</code>
          </p>
        </>
      )}

      {message && <p className="settings-msg">{message}</p>}
    </div>
  )
}
