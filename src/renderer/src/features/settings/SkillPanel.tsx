import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, FolderPlus, RefreshCw, Trash2 } from 'lucide-react'
import { skillDisplayName } from '@shared/skillLabels'
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
      setMessage(`已导入 Skill：${skillDisplayName(result.name)}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '导入失败')
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

  const handleDelete = async (skill: SkillListItem): Promise<void> => {
    const label = skillDisplayName(skill.name)
    const ok = window.confirm(`确定删除 Skill「${label}」？\n\n将移除用户目录中的技能包，此操作不可撤销。`)
    if (!ok) return

    setBusyName(skill.name)
    setMessage('')
    try {
      const list = await window.api.skills.delete(skill.name)
      setSkills(list)
      setMessage(`已删除 Skill：${label}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '删除失败')
    } finally {
      setBusyName(null)
    }
  }

  return (
    <div className="settings-section">
      <h2 className="settings-section-title">Skill</h2>
      <p className="settings-section-desc">
        查看、导入与删除 Agent Skill。启用后会在对话中按场景自动加载；在对话栏 Skill 菜单中可临时排除本次会话。
      </p>

      <div className="skill-panel-actions">
        <IconButton
          icon={FolderPlus}
          label="导入 Skill"
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
          label="刷新列表"
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
          <p className="settings-hint">点击「导入 Skill」安装含 SKILL.md 的文件夹，或在项目中放置 .hanstudy/skills/</p>
        </div>
      ) : (
        <div className="skill-list">
          {skills.map((skill) => (
            <div key={skill.name} className={`skill-item ${skill.enabled ? 'enabled' : 'disabled'}`}>
              <div className="skill-item-main">
                <div className="skill-item-header">
                  <span className="skill-item-name">{skillDisplayName(skill.name)}</span>
                  <span className="skill-item-id">{skill.name}</span>
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
              <div className="skill-item-actions">
                <label className="skill-toggle">
                  <input
                    type="checkbox"
                    checked={skill.enabled}
                    disabled={busyName === skill.name}
                    onChange={() => void handleToggle(skill)}
                  />
                  <span>{skill.enabled ? '已启用' : '已禁用'}</span>
                </label>
                {skill.source === 'user' && (
                  <IconButton
                    icon={Trash2}
                    label="删除 Skill"
                    className="secondary-btn skill-delete-btn"
                    disabled={busyName === skill.name}
                    onClick={() => void handleDelete(skill)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
