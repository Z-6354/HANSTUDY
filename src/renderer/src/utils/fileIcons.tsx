import {
  BookOpen,
  File,
  FileText,
  Folder,
  Settings
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from '../components/IconButton'

function extOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

export function fileTypeIcon(name: string, isDirectory: boolean): LucideIcon {
  if (isDirectory) return Folder
  const ext = extOf(name)
  if (ext === 'pdf') return FileText
  if (ext === 'docx') return FileText
  if (ext === 'md') return BookOpen
  return File
}

interface FileTypeIconProps {
  name: string
  isDirectory?: boolean
  size?: number
  className?: string
}

export function FileTypeIcon({
  name,
  isDirectory = false,
  size = 14,
  className
}: FileTypeIconProps): JSX.Element {
  return <Icon icon={fileTypeIcon(name, isDirectory)} size={size} className={className} />
}

export function TabDocIcon({ type, name }: { type: string; name: string }): JSX.Element {
  if (type === 'settings') {
    return <Icon icon={Settings} size={14} className="tab-type-icon" />
  }
  return <FileTypeIcon name={name} size={14} className="tab-type-icon" />
}
