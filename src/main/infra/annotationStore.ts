import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { Annotation } from '../../shared/types'

const FILE_NAME = 'annotations.json'

async function getStorePath(): Promise<string> {
  const dir = join(app.getPath('userData'), 'data')
  await mkdir(dir, { recursive: true })
  return join(dir, FILE_NAME)
}

async function readAll(): Promise<Annotation[]> {
  try {
    const path = await getStorePath()
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw) as Annotation[]
  } catch {
    return []
  }
}

async function writeAll(annotations: Annotation[]): Promise<void> {
  const path = await getStorePath()
  await writeFile(path, JSON.stringify(annotations, null, 2), 'utf-8')
}

let storeChain: Promise<unknown> = Promise.resolve()

function withStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = storeChain.then(fn, fn)
  storeChain = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

export async function listAnnotations(docPath: string): Promise<Annotation[]> {
  return withStoreLock(async () => {
    const all = await readAll()
    return all
      .filter((a) => a.docPath === docPath)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  })
}

export async function createAnnotation(
  input: Omit<Annotation, 'id' | 'createdAt'>
): Promise<Annotation> {
  return withStoreLock(async () => {
    const annotation: Annotation = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    }
    const all = await readAll()
    all.push(annotation)
    await writeAll(all)
    return annotation
  })
}

export async function updateAnnotation(
  id: string,
  patch: Partial<Pick<Annotation, 'content' | 'color' | 'type' | 'shape'>>
): Promise<Annotation | null> {
  return withStoreLock(async () => {
    const all = await readAll()
    const index = all.findIndex((a) => a.id === id)
    if (index === -1) return null
    all[index] = { ...all[index], ...patch }
    await writeAll(all)
    return all[index]
  })
}

export async function deleteAnnotation(id: string): Promise<boolean> {
  return withStoreLock(async () => {
    const all = await readAll()
    const next = all.filter((a) => a.id !== id)
    if (next.length === all.length) return false
    await writeAll(next)
    return true
  })
}

export async function exportAnnotationsMarkdown(docPath: string): Promise<string> {
  const items = await listAnnotations(docPath)
  const title = docPath.split(/[/\\]/).pop() ?? docPath
  const lines = [`# 标注导出：${title}`, '', `> 导出时间：${new Date().toLocaleString()}`, '']

  for (const item of items) {
    const label =
      item.type === 'highlight'
        ? '高亮'
        : item.type === 'underline'
          ? '下划线'
          : item.type === 'pen'
            ? '画笔'
            : item.type === 'rect'
              ? '方框'
              : '便签'
    lines.push(`## ${label}`)
    if (item.shape?.points?.length) {
      lines.push(`_手绘 ${item.shape.points.length} 个点_`, '')
    }
    if (item.shape?.width != null && item.shape?.height != null) {
      lines.push(`_矩形标注_`, '')
    }
    if (item.selectedText) {
      lines.push('', '> ' + item.selectedText.replace(/\n/g, '\n> '), '')
    }
    if (item.content) {
      lines.push(item.content, '')
    }
    if (item.pdfAnchor) {
      lines.push(`_PDF 第 ${item.pdfAnchor.page} 页_`, '')
    }
    lines.push('---', '')
  }

  return lines.join('\n')
}
