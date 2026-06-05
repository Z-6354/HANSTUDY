interface ContextUsageRingProps {
  usedTokens: number
  maxTokens: number
}

function usageLevel(ratio: number): 'low' | 'medium' | 'high' {
  if (ratio >= 0.85) return 'high'
  if (ratio >= 0.6) return 'medium'
  return 'low'
}

export function ContextUsageRing({ usedTokens, maxTokens }: ContextUsageRingProps): JSX.Element {
  const safeMax = Math.max(maxTokens, 1)
  const ratio = Math.min(usedTokens / safeMax, 1)
  const pct = Math.round(ratio * 100)
  const level = usageLevel(ratio)
  const size = 22
  const stroke = 2.5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - ratio)

  const usedK = usedTokens >= 1000 ? `${(usedTokens / 1000).toFixed(1)}k` : String(usedTokens)
  const maxK = maxTokens >= 1000 ? `${Math.round(maxTokens / 1000)}k` : String(maxTokens)

  return (
    <div
      className={`context-usage-ring level-${level}`}
      title={`上下文用量：约 ${usedTokens.toLocaleString()} / ${maxTokens.toLocaleString()} tokens（${pct}%）`}
      aria-label={`上下文用量 ${pct}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="context-ring-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="context-ring-fg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="context-usage-pct">{pct}%</span>
      <span className="context-usage-tooltip">{usedK}/{maxK}</span>
    </div>
  )
}
