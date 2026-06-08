import { describe, expect, it } from 'vitest'
import { uniqueNotebookName } from '../src/shared/notebookNames'

describe('uniqueNotebookName', () => {
  it('keeps name when no conflict', () => {
    expect(uniqueNotebookName('学习笔记', ['默认笔记本'])).toBe('学习笔记')
  })

  it('appends (1) when base name exists', () => {
    expect(uniqueNotebookName('新笔记本', ['新笔记本'])).toBe('新笔记本 (1)')
  })

  it('increments suffix until unique', () => {
    expect(
      uniqueNotebookName('新笔记本', ['新笔记本', '新笔记本 (1)', '新笔记本 (2)'])
    ).toBe('新笔记本 (3)')
  })

  it('resolves conflict when user input already has suffix', () => {
    expect(uniqueNotebookName('新笔记本 (1)', ['新笔记本 (1)'])).toBe('新笔记本 (2)')
  })
})
