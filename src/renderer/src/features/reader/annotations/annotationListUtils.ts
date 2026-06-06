import type { Annotation } from '../../../types/global.d'

type AnnotationType = Annotation['type']

export const ANNOTATION_RECENT_LIMIT = 8

export const ANNOTATION_CATEGORY_ORDER: AnnotationType[] = [
  'note',
  'highlight',
  'underline',
  'pen',
  'rect'
]

export const ANNOTATION_TYPE_LABELS: Record<AnnotationType, string> = {
  note: '便签',
  highlight: '高亮',
  underline: '下划线',
  pen: '画笔',
  rect: '方框'
}

export function typeLabel(type: string): string {
  return ANNOTATION_TYPE_LABELS[type as AnnotationType] ?? '便签'
}

export function sortAnnotationsByCreatedDesc(annotations: Annotation[]): Annotation[] {
  return [...annotations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function getRecentAnnotations(
  annotations: Annotation[],
  limit = ANNOTATION_RECENT_LIMIT
): Annotation[] {
  return sortAnnotationsByCreatedDesc(annotations).slice(0, limit)
}

export interface AnnotationCategoryGroup {
  type: AnnotationType
  label: string
  items: Annotation[]
}

export function groupAnnotationsByType(annotations: Annotation[]): AnnotationCategoryGroup[] {
  const sorted = sortAnnotationsByCreatedDesc(annotations)
  return ANNOTATION_CATEGORY_ORDER.map((type) => ({
    type,
    label: ANNOTATION_TYPE_LABELS[type],
    items: sorted.filter((a) => a.type === type)
  })).filter((g) => g.items.length > 0)
}

export function formatAnnotationTime(createdAt: string): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
