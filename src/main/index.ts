import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { join, extname } from 'path'
import { stat } from 'fs/promises'
import {
  createAnnotation,
  deleteAnnotation,
  exportAnnotationsMarkdown,
  listAnnotations,
  updateAnnotation
} from './services/annotationBridge'
import {
  getAppSettings,
  saveAppSettings
} from './services/appSettingsService'
import { hasJavaBackendJar, getBackendStatus, startJavaBackend, stopJavaBackend } from './services/javaBridge'
import { getAISettings, normalizeApiKey, saveAISettings, streamChat } from './services/aiService'
import {
  disableSkill,
  enableSkill,
  getUserSkillsDir,
  initSkillService,
  installSkill,
  listSkills,
  reloadSkills,
  setProjectSkillsDir
} from './services/skills/skillService'
import {
  collectFilesFromDirectory,
  createDirectory,
  createFile,
  deletePath,
  getDisplayName,
  getFileType,
  importFilesToDirectory,
  isSupportedDocumentPath,
  listDirectory,
  getDocumentContext,
  readBinaryFile,
  readTextFile,
  renamePath,
  SUPPORTED_EXTENSIONS
} from './services/fileService'
import {
  deleteWebSnapshot,
  getWebSnapshotMetaByPdfPath,
  listWebSnapshots,
  saveWebSnapshot
} from './services/webSnapshotService'
import {
  logWebDiagnostics,
  probeWebUrl,
  runWebDiagnostics
} from './services/webDiagnosticsService'
import {
  addWebBookmark,
  addWebHistory,
  addWebPhone,
  clearWebHistory,
  getWebCredentialPassword,
  isWebBookmarked,
  listWebBookmarks,
  listWebCredentials,
  listWebHistory,
  listWebPhones,
  removeWebBookmark,
  removeWebCredential,
  removeWebHistory,
  removeWebPhone,
  saveWebCredential
} from './services/webLibraryService'
import {
  attachWebGuest,
  destroyWebGuest,
  destroyWebGuestDoc,
  detachWebGuest,
  getWebGuestNavigation,
  getWebGuestUrl,
  initWebGuestService,
  navigateWebGuest,
  openWebGuestDevTools,
  reloadWebGuest,
  setWebGuestBounds,
  webGuestGoBack,
  webGuestGoForward
} from './services/webGuestService'
import type { SaveWebCredentialInput } from '../shared/webLibrary'
import type { AppSettings } from '../shared/appSettings'
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
      nodeIntegration: false,
      webviewTag: true
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

  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences) => {
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.javascript = true
    webPreferences.webgl = true
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  initWebGuestService(mainWindow)
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
    return {
      path: filePath,
      name: getDisplayName(filePath),
      type: getFileType(filePath),
      supported: isSupportedDocumentPath(filePath)
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
      supported: isSupportedDocumentPath(newPath)
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

  ipcMain.handle('appSettings:get', async () => getAppSettings())

  ipcMain.handle('appSettings:save', async (_event, settings: AppSettings) => {
    await saveAppSettings(settings)
    return true
  })

  ipcMain.handle('skills:list', async () => listSkills())

  ipcMain.handle('skills:enable', async (_event, name: string) => {
    await enableSkill(name)
    return true
  })

  ipcMain.handle('skills:disable', async (_event, name: string) => {
    await disableSkill(name)
    return true
  })

  ipcMain.handle('skills:reload', async () => {
    await reloadSkills()
    return listSkills()
  })

  ipcMain.handle('skills:install', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择 Skill 文件夹',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const name = await installSkill(result.filePaths[0])
    return { name, skills: await listSkills() }
  })

  ipcMain.handle('skills:openDir', async () => {
    const dir = getUserSkillsDir()
    await shell.openPath(dir)
    return dir
  })

  ipcMain.handle('skills:setProjectDir', async (_event, rootFolder: string | null) => {
    setProjectSkillsDir(rootFolder?.trim() || null)
    await reloadSkills()
    return listSkills()
  })

  ipcMain.handle(
    'ai:chat',
    async (
      event,
      requestId: string,
      messages: Array<{ role: string; content: string }>,
      contextText?: string,
      documentContext?: { fileName: string; content: string },
      chatMode?: import('../shared/types').ChatMode,
      excludedSkills?: string[]
    ) => {
      const controller = new AbortController()
      activeAiAborts.set(requestId, controller)

      try {
        const result = await streamChat(
          {
            messages: messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
            contextText,
            documentContext,
            chatMode,
            excludedSkills
          },
          (chunk) => {
            event.sender.send('ai:stream-chunk', requestId, chunk)
          },
          controller.signal
        )
        event.sender.send('ai:stream-done', requestId, result.text, result.activeSkills)
        return { ok: true, activeSkills: result.activeSkills }
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

  ipcMain.handle('web:openExternal', async (_event, url: string) => {
    const trimmed = url?.trim()
    if (!trimmed) return false
    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
      await shell.openExternal(parsed.href)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('web:saveSnapshot', async (_event, input: import('../shared/webSnapshot').SaveWebSnapshotInput) => {
    return saveWebSnapshot(input)
  })

  ipcMain.handle('web:listSnapshots', async () => listWebSnapshots())

  ipcMain.handle('web:getSnapshotMeta', async (_event, pdfPath: string) => {
    return getWebSnapshotMetaByPdfPath(pdfPath)
  })

  ipcMain.handle('web:deleteSnapshot', async (_event, id: string) => deleteWebSnapshot(id))

  ipcMain.handle('web:runDiagnostics', async () => {
    const report = await runWebDiagnostics()
    logWebDiagnostics(report)
    return report
  })

  ipcMain.handle('web:probeUrl', async (_event, url: string) => {
    return probeWebUrl(url)
  })

  ipcMain.handle('webLibrary:listHistory', async () => listWebHistory())
  ipcMain.handle('webLibrary:addHistory', async (_event, url: string, title: string) =>
    addWebHistory(url, title)
  )
  ipcMain.handle('webLibrary:removeHistory', async (_event, id: string) => removeWebHistory(id))
  ipcMain.handle('webLibrary:clearHistory', async () => clearWebHistory())

  ipcMain.handle('webLibrary:listBookmarks', async () => listWebBookmarks())
  ipcMain.handle('webLibrary:addBookmark', async (_event, url: string, title: string) =>
    addWebBookmark(url, title)
  )
  ipcMain.handle('webLibrary:removeBookmark', async (_event, id: string) => removeWebBookmark(id))
  ipcMain.handle('webLibrary:isBookmarked', async (_event, url: string) => isWebBookmarked(url))

  ipcMain.handle('webLibrary:listCredentials', async () => listWebCredentials())
  ipcMain.handle('webLibrary:saveCredential', async (_event, input: SaveWebCredentialInput) =>
    saveWebCredential(input)
  )
  ipcMain.handle('webLibrary:removeCredential', async (_event, id: string) =>
    removeWebCredential(id)
  )
  ipcMain.handle('webLibrary:getCredentialPassword', async (_event, id: string) =>
    getWebCredentialPassword(id)
  )

  ipcMain.handle('webLibrary:listPhones', async () => listWebPhones())
  ipcMain.handle('webLibrary:addPhone', async (_event, phone: string, origin?: string) => {
    const phones = await addWebPhone(phone, origin)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('webLibrary:phonesChanged', phones)
    }
    return phones
  })
  ipcMain.handle('webLibrary:removePhone', async (_event, id: string) => {
    const phones = await removeWebPhone(id)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('webLibrary:phonesChanged', phones)
    }
    return phones
  })

  ipcMain.handle('webGuest:attach', async (_event, docId: string, bounds) => {
    attachWebGuest(docId, bounds)
    return { ok: true, url: getWebGuestUrl(), ...getWebGuestNavigation() }
  })
  ipcMain.handle('webGuest:detach', async () => {
    detachWebGuest()
    return { ok: true }
  })
  ipcMain.handle('webGuest:destroy', async () => {
    destroyWebGuest()
    return { ok: true }
  })
  ipcMain.handle('webGuest:destroyDoc', async (_event, docId: string) => {
    destroyWebGuestDoc(docId)
    return { ok: true }
  })
  ipcMain.handle('webGuest:setBounds', async (_event, bounds) => {
    setWebGuestBounds(bounds)
    return { ok: true }
  })
  ipcMain.handle('webGuest:navigate', async (_event, docId: string, url: string) => {
    const started = navigateWebGuest(docId, url)
    return { ok: true, url: getWebGuestUrl(), started }
  })
  ipcMain.handle('webGuest:back', async () => ({ ok: webGuestGoBack() }))
  ipcMain.handle('webGuest:forward', async () => ({ ok: webGuestGoForward() }))
  ipcMain.handle('webGuest:reload', async () => {
    reloadWebGuest()
    return { ok: true }
  })
  ipcMain.handle('webGuest:getState', async () => ({
    url: getWebGuestUrl(),
    ...getWebGuestNavigation()
  }))
  ipcMain.handle('webGuest:openDevTools', async () => {
    openWebGuestDevTools()
    return { ok: true }
  })

  ipcMain.handle('backend:getStatus', async () => getBackendStatus())
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function setupWebviewSession(): void {
  const webPartition = session.fromPartition('persist:hanstudy-web')
  const ua = webPartition
    .getUserAgent()
    .replace(/\sElectron\/[^\s]+/g, '')
    .replace(/\sHanStudy[^\s]*/gi, '')
    .trim()
  if (ua) {
    webPartition.setUserAgent(ua)
  }
  webPartition.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(true)
  })
}

function bootApp(): void {
  void (async () => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.hanstudy.reader')
    }

    setupWebviewSession()

    if (hasJavaBackendJar()) {
      try {
        await startJavaBackend()
        console.log('[main] Java backend started')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[main] Java backend failed to start, falling back to Node services:', message)
        if (app.isPackaged) {
          dialog.showErrorBox(
            '标注服务启动失败',
            `Java 后端未能启动，标注将使用本地备用存储。\n\n${message}\n\n若持续出现，请重新安装应用或联系支持。`
          )
        }
      }
    }

    try {
      await initSkillService()
      console.log('[main] Skill service initialized')
    } catch (err) {
      console.error('[main] Skill service failed to initialize:', err)
    }

    registerIpcHandlers()
    createWindow()
  })()
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    bootApp()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', () => {
    destroyWebGuest()
    void stopJavaBackend()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
