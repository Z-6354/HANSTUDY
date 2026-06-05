import { BookOpen } from 'lucide-react'

export function AppIcon(): JSX.Element {
  return (
    <div className="app-icon-wrap">
      <BookOpen size={16} strokeWidth={2} color="#0078d4" aria-hidden />
    </div>
  )
}
