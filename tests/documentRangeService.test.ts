import { mkdtemp, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_READ_DOCUMENT_LINES,
  readDocumentByLineRange
} from '../src/main/infra/documentRangeService'

describe('readDocumentByLineRange', () => {
  it('reads line range from txt file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hanstudy-range-'))
    const filePath = join(dir, 'sample.txt')
    await writeFile(filePath, ['line1', 'line2', 'line3', 'line4'].join('\n'), 'utf-8')

    const result = await readDocumentByLineRange(filePath, 2, 2)
    expect(result.startLine).toBe(2)
    expect(result.endLine).toBe(3)
    expect(result.totalLines).toBe(4)
    expect(result.content).toBe('line2\nline3')
    expect(result.truncated).toBe(true)
  })

  it('defaults limit to DEFAULT_READ_DOCUMENT_LINES', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hanstudy-range-'))
    const filePath = join(dir, 'one.txt')
    await writeFile(filePath, 'only', 'utf-8')
    const result = await readDocumentByLineRange(filePath)
    expect(result.content).toBe('only')
    expect(result.endLine).toBe(1)
    expect(DEFAULT_READ_DOCUMENT_LINES).toBe(200)
  })
})
