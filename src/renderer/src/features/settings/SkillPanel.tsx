import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, FolderPlus, RefreshCw } from 'lucide-react'
import { IconButton } from '../../components/IconButton'
import type { SkillListItem } from '../../types/global.d'

const SOURCE_LABEL: Record<SkillListItem['source'], string> = {
  builtin: '内置',
  user: '用户',
  project: '项目'
}

export function SkillPanel(): JSX.Element {
  const [skills, setSkills] = useState<SkillListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busyName, setBusyName] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const list = await window.api.skills.list()
      setSkills(list)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '加载 Skill 失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleToggle = async (skill: SkillListItem): Promise<void> => {
    setBusyName(skill.name)
    setMessage('')
    try {
      if (skill.enabled) {
        await window.api.skills.disable(skill.name)
      } else {
        await window.api.skills.enable(skill.name)
      }
      await refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '切换失败')
    } finally {
      setBusyName(null)
    }
  }

  const handleInstall = async (): Promise<void> => {
    setMessage('')
    try {
      const result = await window.api.skills.install()
      if (!result) return
      setSkills(result.skills)
      setMessage(`已安装 Skill：${result.name}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '安装失败')
    }
  }

  const handleOpenDir = async (): Promise<void> => {
    setMessage('')
    try {
      await window.api.skills.openDir()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '无法打开目录')
    }
  }

  return (
    <div className="settings-section">
      <h2 className="settings-section-title">Skill</h2>
      <p className="settings-section-desc">
        管理 Agent Skill 技能包。启用后会在对话中按场景自动加载（参考 hancli 索引 + 按需注入模式）。
      </p>

      <div className="skill-panel-actions">
        <IconButton
          icon={FolderPlus}
          label="从文件夹安装"
          className="secondary-btn"
          onClick={() => void handleInstall()}
        />
        <IconButton
          icon={FolderOpen}
          label="打开 Skill 目录"
          className="secondary-btn"
          onClick={() => void handleOpenDir()}
        />
        <IconButton
          icon={RefreshCw}
          label="重新扫描"
          className="secondary-btn"
          onClick={() => void refresh()}
        />
      </div>

      {message && <p className="settings-msg">{message}</p>}

      {loading ? (
        <p className="settings-hint">加载中...</p>
      ) : skills.length === 0 ? (
        <div className="settings-placeholder">
          <p>未发现 Skill</p>
          <p className="settings-hint">可将含 SKILL.md 的文件夹安装到用户目录，或在项目中放置 .hanstudy/skills/</p>
        </div>
      ) : (
        <div className="skill-list">
          {skills.map((skill) => (
            <div key={skill.name} className={`skill-item ${skill.enabled ? 'enabled' : 'disabled'}`}>
              <div className="skill-item-main">
                <div className="skill-item-header">
                  <span className="skill-item-name">{skill.name}</span>
                  <span className={`skill-source-badge source-${skill.source}`}>
                    {SOURCE_LABEL[skill.source]}
                  </span>
                </div>
                <p className="skill-item-desc">{skill.description || '（无描述）'}</p>
                {skill.tags.length > 0 && (
                  <div className="skill-item-tags">
                    {skill.tags.map((tag) => (
                      <span key={tag} className="skill-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="skill-item-path">{skill.skillMdPath}</p>
              </div>
              <label className="skill-toggle">
                <input
                  type="checkbox"
                  checked={skill.enabled}
                  disabled={busyName === skill.name}
                  onChange={() => void handleToggle(skill)}
                />
                <span>{skill.enabled ? '已启用' : '已禁用'}</span>
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
