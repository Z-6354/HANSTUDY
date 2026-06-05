import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, CSSProperties } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  size?: number
  active?: boolean
  iconClassName?: string
}

export function IconButton({
  icon: Icon,
  label,
  size = 16,
  active,
  className = '',
  iconClassName,
  ...props
}: IconButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? 'active' : ''} ${className}`.trim()}
      title={label}
      aria-label={label}
      {...props}
    >
      <Icon size={size} strokeWidth={1.75} className={iconClassName} aria-hidden />
    </button>
  )
}

interface IconProps {
  icon: LucideIcon
  size?: number
  className?: string
  style?: CSSProperties
}

export function Icon({ icon: IconComp, size = 16, className, style }: IconProps): JSX.Element {
  return <IconComp size={size} strokeWidth={1.75} className={className} style={style} aria-hidden />
}
