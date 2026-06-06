import { describe, expect, it } from 'vitest'
import {
  getRecentAnnotations,
  groupAnnotationsByType,
  sortAnnotationsByCreatedDesc
} from '../src/renderer/src/features/reader/annotations/annotationListUtils'
import type { Annotation } from '../src/shared/types'

function ann(id: string, type: Annotation['type'], createdAt: string): Annotation {
  return { id, docPath: '/a.pdf', type, color: '#000', createdAt }
}

describe('annotationListUtils', () => {
  const list = [
    ann('1', 'highlight', '2026-06-06T10:00:00Z'),
    ann('2', 'note', '2026-06-06T12:00:00Z'),
    ann('3', 'pen', '2026-06-06T11:00:00Z'),
    ann('4', 'underline', '2026-06-05T09:00:00Z')
  ]

  it('sortAnnotationsByCreatedDesc orders newest first', () => {
    expect(sortAnnotationsByCreatedDesc(list).map((a) => a.id)).toEqual(['2', '3', '1', '4'])
  })

  it('getRecentAnnotations limits count', () => {
    expect(getRecentAnnotations(list, 2).map((a) => a.id)).toEqual(['2', '3'])
  })

  it('groupAnnotationsByType groups in category order', () => {
    const groups = groupAnnotationsByType(list)
    expect(groups.map((g) => g.type)).toEqual(['note', 'highlight', 'underline', 'pen'])
    expect(groups[0].items).toHaveLength(1)
    expect(groups[0].items[0].id).toBe('2')
  })
})
