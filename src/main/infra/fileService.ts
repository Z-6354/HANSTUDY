import { readFile, copyFile, cp, mkdir, readdir, rename, rm, stat, writeFile } from 'fs/promises'
import mammoth from 'mammoth'
import { basename, extname, join } from 'path'
import { extractMdSection, extractTxtWindow, MAX_AI_DOC_CONTEXT } from '../../shared/documentContextExtract'

export const SUPPORTED_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.pdf',
  '.docx'
])

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

export function getFileType(
  filePath: string
): 'txt' | 'md' | 'pdf' | 'docx' | 'unknown' {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.pdf') return 'pdf'
  if (ext === '.docx') return 'docx'
  if (ext === '.md') return 'md'
  if (ext === '.txt') return 'txt'
  return 'unknown'
}

export function isSupportedDocumentPath(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase())
}

export async function readTextFile(filePath: string): Promise<string> {
  const doc = await readTextDocument(filePath)
  return doc.content
}

export async function readTextDocument(
  filePath: string
): Promise<{ content: string; sizeBytes: number }> {
  const [buffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)])
  return { content: decodeTextBuffer(buffer), sizeBytes: fileStat.size }
}

function decodeTextBuffer(buffer: Buffer): string {
  if (buffer.length === 0) return ''

  // UTF-8 BOM
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf-8')
  }

  const utf8 = buffer.toString('utf-8')
  if (!utf8.includes('\uFFFD')) return utf8

  if (process.platform === 'win32') {
    try {
      return new TextDecoder('gbk').decode(buffer)
    } catch {
      // ignore
    }
  }

  return utf8
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, 'utf-8')
}

export async function readBinaryFile(filePath: string): Promise<Uint8Array> {
  const buffer = await readFile(filePath)
  return new Uint8Array(buffer)
}

export async function listDirectory(dirPath: string): Promise<FileEntry[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const result: FileEntry[] = []

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      result.push({ name: entry.name, path: fullPath, isDirectory: true })
      continue
    }
    result.push({ name: entry.name, path: fullPath, isDirectory: false })
  }

  return result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function collectFilesFromDirectory(dirPath: string): Promise<FileEntry[]> {
  const entries = await listDirectory(dirPath)
  const files: FileEntry[] = []

  for (const entry of entries) {
    if (entry.isDirectory) {
      const nested = await collectFilesFromDirectory(entry.path)
      files.push(...nested)
    } else {
      files.push(entry)
    }
  }

  return files
}

export function getDisplayName(filePath: string): string {
  return basename(filePath)
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

export async function createFile(dirPath: string, fileName: string, content = ''): Promise<string> {
  const safeName = fileName.trim()
  if (!safeName) throw new Error('文件名不能为空')
  const filePath = join(dirPath, safeName)
  if (await fileExists(filePath)) throw new Error('文件已存在')
  await writeFile(filePath, content, 'utf-8')
  return filePath
}

export async function createDirectory(dirPath: string, dirName: string): Promise<string> {
  const safeName = dirName.trim()
  if (!safeName) throw new Error('文件夹名不能为空')
  const folderPath = join(dirPath, safeName)
  if (await fileExists(folderPath)) throw new Error('文件夹已存在')
  await mkdir(folderPath, { recursive: false })
  return folderPath
}

export async function deletePath(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true })
}

export async function renamePath(targetPath: string, newName: string): Promise<string> {
  const safeName = newName.trim()
  if (!safeName) throw new Error('名称不能为空')
  const parent = join(targetPath, '..')
  const newPath = join(parent, safeName)
  if (await fileExists(newPath)) throw new Error('目标名称已存在')
  await rename(targetPath, newPath)
  return newPath
}

export interface ImportResult {
  path: string
  name: string
  error?: string
}

async function uniqueDestPath(targetDir: string, fileName: string): Promise<string> {
  const ext = extname(fileName)
  const base = basename(fileName, ext)
  let candidate = join(targetDir, fileName)
  let counter = 1
  while (await fileExists(candidate)) {
    candidate = join(targetDir, `${base} (${counter})${ext}`)
    counter++
  }
  return candidate
}

export async function importFilesToDirectory(
  targetDir: string,
  sourcePaths: string[]
): Promise<ImportResult[]> {
  const dirStat = await stat(targetDir)
  if (!dirStat.isDirectory()) {
    throw new Error('目标路径不是有效的文件夹')
  }

  const results: ImportResult[] = []
  for (const src of sourcePaths) {
    const name = basename(src)
    try {
      const srcStat = await stat(src)
      if (!srcStat.isFile()) {
        results.push({ path: join(targetDir, name), name, error: '只能导入文件，不能导入文件夹' })
        continue
      }
      const dest = await uniqueDestPath(targetDir, name)
      try {
        await cp(src, dest)
      } catch {
        await copyFile(src, dest)
      }
      results.push({ path: dest, name: basename(dest) })
    } catch (err) {
      results.push({
        path: join(targetDir, name),
        name,
        error: err instanceof Error ? err.message : '导入失败'
      })
    }
  }
  return results
}

export interface DocumentContextOptions {
  monacoLine?: number
  scrollRatio?: number
}

export interface DocumentContext {
  fileName: string
  content: string
  truncated: boolean
  sectionTitle?: string
}

export async function getAiChatDocumentContext(
  filePath: string,
  options: DocumentContextOptions = {}
): Promise<DocumentContext> {
  const fileName = basename(filePath)
  const ext = extname(filePath).toLowerCase()
  if (ext !== '.txt' && ext !== '.md') {
    throw new Error('暂仅支持 TXT / Markdown 加入 AI 对话')
  }

  const full = await readTextFile(filePath)
  const extracted =
    ext === '.md'
      ? extractMdSection(full, options.monacoLine)
      : extractTxtWindow(full, options.monacoLine, options.scrollRatio)

  return {
    fileName,
    content: extracted.content,
    truncated: extracted.truncated,
    sectionTitle: extracted.sectionTitle
  }
}

export async function getDocumentContext(filePath: string): Promise<DocumentContext> {
  const fileName = basename(filePath)
  const ext = extname(filePath).toLowerCase()
  let content = ''

  if (ext === '.txt' || ext === '.md') {
    content = await readTextFile(filePath)
  } else if (ext === '.docx') {
    const buffer = await readFile(filePath)
    const result = await mammoth.extractRawText({ buffer })
    content = result.value
  } else if (ext === '.pdf') {
    const { extractPdfText } = await import('./pdfTextService')
    content = await extractPdfText(filePath)
    if (!content.trim()) {
      content =
        '（未能从 PDF 中提取可读文本，可能是扫描件或图片 PDF。请在阅读区选中文字（若有文本层）或使用便签标注。）'
    }
  } else {
    content = '（不支持该格式的全文提取）'
  }

  const truncated = content.length > MAX_AI_DOC_CONTEXT
  if (truncated) {
    content = content.slice(0, MAX_AI_DOC_CONTEXT) + '\n\n…（文档过长，已截断）'
  }

  return { fileName, content, truncated }
}
