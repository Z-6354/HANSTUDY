import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join, extname } from 'path'
import { stat } from 'fs/promises'
import {
  createAnnotation,
  deleteAnnotation,
  exportAnnotationsMarkdown,
  listAnnotations,
  updateAnnotation
} from './services/annotationStore'
import { getAISettings, normalizeApiKey, saveAISettings, streamChat } from './services/aiService'
import {
  collectFilesFromDirectory,
  createDirectory,
  createFile,
  deletePath,
  getDisplayName,
  getFileType,
  importFilesToDirectory,
  listDirectory,
  getDocumentContext,
  readBinaryFile,
  readTextFile,
  renamePath,
  SUPPORTED_EXTENSIONS
} from './services/fileService'
import type { Annotation, AISettings } from '../shared/types'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
const activeAiAborts = new Map<string, AbortController>()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.maximize()
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)

  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [{ name: 'Documents', extensions: ['txt', 'md', 'pdf', 'docx'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    return { path: filePath, name: getDisplayName(filePath), type: getFileType(filePath) }
  })

  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const folderPath = result.filePaths[0]
    const files = await collectFilesFromDirectory(folderPath)
    return { path: folderPath, files }
  })

  ipcMain.handle('dialog:importFiles', async (_event, targetDir: string) => {
    if (!targetDir?.trim()) {
      throw new Error('请先打开目标文件夹')
    }
    try {
      await stat(targetDir)
    } catch {
      throw new Error('目标文件夹不存在，请重新打开文件夹')
    }

    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择要导入的文件',
      defaultPath: targetDir,
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '文档', extensions: ['txt', 'md', 'pdf', 'docx', 'doc'] }]
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { imported: [], canceled: true }
    }
    const imported = await importFilesToDirectory(targetDir, result.filePaths)
    return { imported, canceled: false }
  })

  ipcMain.handle('dialog:saveMarkdown', async (_event, content: string, defaultName: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled || !result.filePath) return false
    const { writeFile } = await import('fs/promises')
    await writeFile(result.filePath, content, 'utf-8')
    return true
  })

  ipcMain.handle('fs:listDirectory', async (_event, dirPath: string) => {
    return listDirectory(dirPath)
  })

  ipcMain.handle('fs:readText', async (_event, filePath: string) => {
    return readTextFile(filePath)
  })

  ipcMain.handle('fs:readBinary', async (_event, filePath: string) => {
    const data = await readBinaryFile(filePath)
    return Array.from(data)
  })

  ipcMain.handle('fs:getFileInfo', async (_event, filePath: string) => {
    const ext = extname(filePath).toLowerCase()
    return {
      path: filePath,
      name: getDisplayName(filePath),
      type: getFileType(filePath),
      supported: SUPPORTED_EXTENSIONS.has(ext)
    }
  })

  ipcMain.handle('fs:createFile', async (_event, dirPath: string, fileName: string) => {
    const filePath = await createFile(dirPath, fileName)
    return { path: filePath, name: getDisplayName(filePath), type: getFileType(filePath) }
  })

  ipcMain.handle('fs:createFolder', async (_event, dirPath: string, folderName: string) => {
    const folderPath = await createDirectory(dirPath, folderName)
    return { path: folderPath, name: getDisplayName(folderPath), isDirectory: true }
  })

  ipcMain.handle('fs:delete', async (_event, targetPath: string) => {
    await deletePath(targetPath)
    return true
  })

  ipcMain.handle('fs:rename', async (_event, targetPath: string, newName: string) => {
    const newPath = await renamePath(targetPath, newName)
    const ext = extname(newPath).toLowerCase()
    return {
      path: newPath,
      name: getDisplayName(newPath),
      type: getFileType(newPath),
      supported: SUPPORTED_EXTENSIONS.has(ext)
    }
  })

  ipcMain.handle('fs:getDocumentContext', async (_event, filePath: string) => {
    return getDocumentContext(filePath)
  })

  ipcMain.handle('annotations:list', async (_event, docPath: string) => {
    return listAnnotations(docPath)
  })

  ipcMain.handle('annotations:create', async (_event, input: Omit<Annotation, 'id' | 'createdAt'>) => {
    return createAnnotation(input)
  })

  ipcMain.handle('annotations:update', async (_event, id: string, patch: Partial<Annotation>) => {
    return updateAnnotation(id, patch)
  })

  ipcMain.handle('annotations:delete', async (_event, id: string) => {
    return deleteAnnotation(id)
  })

  ipcMain.handle('annotations:export', async (_event, docPath: string) => {
    return exportAnnotationsMarkdown(docPath)
  })

  ipcMain.handle('settings:get', async () => {
    const settings = await getAISettings()
    return { ...settings, apiKey: settings.apiKey ? '********' : '' }
  })

  ipcMain.handle('settings:getRaw', async () => {
    return getAISettings()
  })

  ipcMain.handle('settings:save', async (_event, settings: AISettings) => {
    const current = await getAISettings()
    const rawKey =
      settings.apiKey === '********' || !settings.apiKey.trim()
        ? current.apiKey
        : settings.apiKey
    const next: AISettings = {
      provider: settings.provider || current.provider,
      baseUrl: settings.baseUrl,
      model: settings.model,
      apiKey: normalizeApiKey(rawKey),
      enableThinking: settings.enableThinking
    }
    if (!next.apiKey) {
      throw new Error('API 密钥不能为空')
    }
    await saveAISettings(next)
    return true
  })

  ipcMain.handle(
    'ai:chat',
    async (
      event,
      requestId: string,
      messages: Array<{ role: string; content: string }>,
      contextText?: string,
      documentContext?: { fileName: string; content: string },
      chatMode?: import('../shared/types').ChatMode
    ) => {
      const controller = new AbortController()
      activeAiAborts.set(requestId, controller)

      try {
        const full = await streamChat(
          {
            messages: messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
            contextText,
            documentContext,
            chatMode
          },
          (chunk) => {
            event.sender.send('ai:stream-chunk', requestId, chunk)
          },
          controller.signal
        )
        event.sender.send('ai:stream-done', requestId, full)
        return { ok: true }
      } catch (err) {
        if (controller.signal.aborted) {
          event.sender.send('ai:stream-aborted', requestId)
          return { ok: true, aborted: true }
        }
        const message = err instanceof Error ? err.message : 'AI 请求失败'
        event.sender.send('ai:stream-error', requestId, message)
        return { ok: false, error: message }
      } finally {
        activeAiAborts.delete(requestId)
      }
    }
  )

  ipcMain.handle('ai:abort', async (_event, requestId: string) => {
    activeAiAborts.get(requestId)?.abort()
    activeAiAborts.delete(requestId)
  })
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.hanstudy.reader')
  }

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
