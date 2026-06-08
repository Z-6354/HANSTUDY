import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Puzzle } from 'lucide-react'
import { skillDisplayName } from '@shared/skillLabels'

export interface AISkillItem {
  name: string
  description: string
}

interface AISkillMenuProps {
  skills: AISkillItem[]
  excludedSkills: string[]
  onToggle: (name: string) => void
}

export function AISkillMenu({
  skills,
  excludedSkills,
  onToggle
}: AISkillMenuProps): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const activeCount = skills.filter((skill) => !excludedSkills.includes(skill.name)).length
  const hasPartial = activeCount < skills.length

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (skills.length === 0) return null

  return (
    <div className="ai-skill-menu" ref={ref}>
      <button
        type="button"
        className={`ai-skill-menu-trigger${hasPartial ? ' has-partial' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="选择本次对话启用的 Skill"
        onClick={() => setOpen((v) => !v)}
      >
        <Puzzle size={12} aria-hidden />
        <span>Skill</span>
        <span className="ai-skill-menu-count">
          {activeCount}/{skills.length}
        </span>
        <ChevronDown size={12} className={`ai-skill-menu-chevron${open ? ' open' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="ai-skill-menu-panel" role="listbox" aria-label="Skill 列表">
          {skills.map((skill) => {
            const excluded = excludedSkills.includes(skill.name)
            const label = skillDisplayName(skill.name)
            const tip = skill.description?.trim() || label
            return (
              <button
                key={skill.name}
                type="button"
                role="option"
                aria-selected={!excluded}
                className={`ai-skill-menu-row${excluded ? ' excluded' : ''}`}
                title={tip}
                onClick={() => onToggle(skill.name)}
              >
                <span className="ai-skill-menu-indicator" aria-hidden>
                  {!excluded ? <Check size={11} strokeWidth={2.5} /> : null}
                </span>
                <span className="ai-skill-menu-item-label">{label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
