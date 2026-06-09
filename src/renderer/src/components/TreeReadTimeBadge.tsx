import { Clock } from 'lucide-react'
import { formatLastReadTime } from '../utils/formatLastReadTime'

const RECENT_MS = 86_400_000

function isRecentRead(iso: string, now = new Date()): boolean {
  const readAt = new Date(iso).getTime()
  if (Number.isNaN(readAt)) return false
  return now.getTime() - readAt < RECENT_MS
}

interface TreeReadTimeBadgeProps {
  iso: string
  /** 收藏/最近列表中始终显示；文件树中默认悬停显示 */
  alwaysVisible?: boolean
}

export function TreeReadTimeBadge({
  iso,
  alwaysVisible = false
}: TreeReadTimeBadgeProps): JSX.Element {
  const label = formatLastReadTime(iso)
  if (!label) return <></>

  const full = new Date(iso).toLocaleString('zh-CN')
  const recent = isRecentRead(iso)

  return (
    <span
      className={[
        'tree-read-time',
        recent ? 'tree-read-time--recent' : '',
        alwaysVisible ? 'tree-read-time--pinned' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      title={`最近阅读：${full}`}
    >
      <Clock size={10} strokeWidth={2} className="tree-read-time-icon" aria-hidden />
      <span className="tree-read-time-label">{label}</span>
    </span>
  )
}
