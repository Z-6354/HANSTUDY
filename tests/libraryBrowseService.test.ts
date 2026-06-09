import { mkdir, mkdtemp, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\mock-user-data' }
}))

let libraryRoot = ''

vi.mock('../src/main/infra/localLibraryService', () => ({
  getLocalLibraryRoot: () => libraryRoot,
  ensureLocalLibraryDir: async () => libraryRoot,
  isLocalLibraryPath: (filePath: string) => {
    const n = filePath.replace(/\\/g, '/').toLowerCase()
    const r = libraryRoot.replace(/\\/g, '/').toLowerCase()
    return n === r || n.startsWith(`${r}/`)
  }
}))

vi.mock('../src/main/infra/readingProgressService', () => ({
  listReadingProgressIndex: async () => ({})
}))

describe('libraryBrowseService', () => {
  beforeEach(() => {
    libraryRoot = ''
  })

  it('listLibraryEntries lists shallow entries', async () => {
    libraryRoot = await mkdtemp(join(tmpdir(), 'hanstudy-lib-'))
    await writeFile(join(libraryRoot, 'a.md'), '# A', 'utf-8')
    await mkdir(join(libraryRoot, 'sub'))

    const { listLibraryEntries } = await import('../src/main/infra/libraryBrowseService')
    const entries = await listLibraryEntries({ recursive: false })
    const names = entries.map((e) => e.name).sort()
    expect(names).toContain('a.md')
    expect(names).toContain('sub')
  })

  it('searchInLibrary finds keyword across files', async () => {
    libraryRoot = await mkdtemp(join(tmpdir(), 'hanstudy-lib-'))
    await writeFile(join(libraryRoot, 'one.md'), 'alpha beta', 'utf-8')
    await writeFile(join(libraryRoot, 'two.txt'), 'gamma delta', 'utf-8')

    const { searchInLibrary } = await import('../src/main/infra/libraryBrowseService')
    const hits = await searchInLibrary({ query: 'beta', maxResults: 10 })
    expect(hits).toHaveLength(1)
    expect(hits[0]!.fileName).toBe('one.md')
    expect(hits[0]!.line).toBe(1)
    expect(hits[0]!.text).toContain('beta')
  })

  it('globLibraryFiles matches filename patterns', async () => {
    libraryRoot = await mkdtemp(join(tmpdir(), 'hanstudy-lib-'))
    await mkdir(join(libraryRoot, 'papers'))
    await writeFile(join(libraryRoot, 'papers', 'intro.pdf'), '%PDF', 'utf-8')
    await writeFile(join(libraryRoot, 'readme.md'), '# hi', 'utf-8')

    const { globLibraryFiles } = await import('../src/main/infra/libraryBrowseService')
    const matches = await globLibraryFiles({ pattern: '**/*.pdf' })
    expect(matches).toHaveLength(1)
    expect(matches[0]!.name).toBe('intro.pdf')
  })

  it('rejects paths outside library', async () => {
    libraryRoot = await mkdtemp(join(tmpdir(), 'hanstudy-lib-'))
    const { resolvePathUnderLocalLibrary } = await import('../src/main/infra/libraryBrowseService')
    expect(() => resolvePathUnderLocalLibrary('C:\\outside\\secret.txt')).toThrow(/资料库/)
  })
})
