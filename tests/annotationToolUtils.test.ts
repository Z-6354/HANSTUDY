import { describe, expect, it } from 'vitest'
import {
  annotationCreateInput,
  findLastAnnotationByType,
  toolUsesRightClickUndo
} from '../src/renderer/src/features/reader/annotations/annotationToolUtils'
import type { Annotation } from '../src/shared/types'

const sample = (type: Annotation['type'], id: string): Annotation => ({
  id,
  docPath: '/a.pdf',
  type,
  color: '#000',
  createdAt: '2026-01-01',
  selectedText: type === 'highlight' ? 'hello' : undefined
})

describe('annotationToolUtils', () => {
  it('toolUsesRightClickUndo excludes select only', () => {
    expect(toolUsesRightClickUndo('select')).toBe(false)
    expect(toolUsesRightClickUndo('pen')).toBe(true)
    expect(toolUsesRightClickUndo('eraser')).toBe(true)
  })

  it('findLastAnnotationByType returns most recent', () => {
    const list = [sample('pen', '1'), sample('pen', '2'), sample('rect', '3')]
    expect(findLastAnnotationByType(list, 'pen')?.id).toBe('2')
    expect(findLastAnnotationByType(list, 'rect')?.id).toBe('3')
  })

  it('annotationCreateInput strips server fields', () => {
    const input = annotationCreateInput(sample('note', 'x'))
    expect(input).toEqual({ type: 'note', color: '#000', selectedText: undefined })
    expect('id' in input).toBe(false)
  })
})
