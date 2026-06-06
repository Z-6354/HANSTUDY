import { app } from 'electron'
import { createHash, randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import type { SaveWebSnapshotInput, WebSnapshotMeta } from '../../shared/webSnapshot'
import { WEB_PAGE_LAYOUT_WIDTH } from '../../shared/webCrop'

function getSnapshotsRoot(): string {
  return join(app.getPath('userData'), 'data', 'web-snapshots')
}

function metaPathForDir(dir: string): string {
  return join(dir, 'meta.json')
}

async function readMetaFile(metaPath: string): Promise<WebSnapshotMeta | null> {
  if (!existsSync(metaPath)) return null
  try {
    const raw = await readFile(metaPath, 'utf-8')
    return JSON.parse(raw) as WebSnapshotMeta
  } catch {
    return null
  }
}

export function getWebSnapshotsRoot(): string {
  return getSnapshotsRoot()
}

export async function saveWebSnapshot(input: SaveWebSnapshotInput): Promise<WebSnapshotMeta> {
  const id = randomUUID()
  const dir = join(getSnapshotsRoot(), id)
  await mkdir(dir, { recursive: true })

  const pdfPath = join(dir, 'page.pdf')
  const pdfBuffer = Buffer.from(input.pdf)
  await writeFile(pdfPath, pdfBuffer)

  const contentHash = createHash('sha256').update(pdfBuffer).digest('hex')
  const meta: WebSnapshotMeta = {
    id,
    sourceUrl: input.sourceUrl,
    finalUrl: input.finalUrl,
    title: input.title.trim() || '网页快照',
    savedAt: new Date().toISOString(),
    format: 'pdf',
    contentHash,
    pdfPath,
    viewport: input.viewport ?? { width: WEB_PAGE_LAYOUT_WIDTH, height: 720 },
    crop: input.crop
  }

  await writeFile(metaPathForDir(dir), JSON.stringify(meta, null, 2), 'utf-8')
  return meta
}

export async function listWebSnapshots(): Promise<WebSnapshotMeta[]> {
  const root = getSnapshotsRoot()
  if (!existsSync(root)) return []

  const entries = await readdir(root, { withFileTypes: true })
  const metas: WebSnapshotMeta[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const meta = await readMetaFile(metaPathForDir(join(root, entry.name)))
    if (meta) metas.push(meta)
  }

  return metas.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export async function getWebSnapshotMetaByPdfPath(pdfPath: string): Promise<WebSnapshotMeta | null> {
  const dir = join(pdfPath, '..')
  return readMetaFile(metaPathForDir(dir))
}

export async function getWebSnapshotMetaById(id: string): Promise<WebSnapshotMeta | null> {
  return readMetaFile(metaPathForDir(join(getSnapshotsRoot(), id)))
}

export async function deleteWebSnapshot(id: string): Promise<boolean> {
  const dir = join(getSnapshotsRoot(), id)
  if (!existsSync(dir)) return false
  await rm(dir, { recursive: true, force: true })
  return true
}

export async function getWebSnapshotDocumentContext(
  pdfPath: string
): Promise<{ fileName: string; content: string; truncated: boolean; sourceUrl?: string }> {
  const meta = await getWebSnapshotMetaByPdfPath(pdfPath)
  const fileName = meta ? `[网页] ${meta.title}` : pdfPath.split(/[/\\]/).pop() ?? 'page.pdf'
  const sourceLine = meta ? `来源：${meta.sourceUrl}\n保存于：${meta.savedAt}\n\n` : ''
  const content =
    `${sourceLine}` +
    '（网页 PDF 快照正文暂不支持全文提取。请在阅读区使用便签/画笔标注，或选中文字后 Ask AI。）'
  return { fileName, content, truncated: false, sourceUrl: meta?.sourceUrl }
}
