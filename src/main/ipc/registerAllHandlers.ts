import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { stat, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { IPC } from '../../shared/ipc/channels'
import type { AppSettings } from '../../shared/appSettings'
import type { Annotation, AISettings } from '../../shared/types'
import { getAppContext } from '../bootstrap/AppContext'
import { ipcRegistry } from './IpcRegistry'
import {
  createAnnotation,
  deleteAnnotation,
  exportAnnotationsMarkdown,
  listAnnotations,
  updateAnnotation
} from '../infra/annotationBridge'
import { getAppSettings, saveAppSettings } from '../config/appSettingsService'
import { getBackendStatus } from '../runtime/javaBridge'
import { buildFullMemorySnapshot } from '../infra/memoryDiagnostics'
import {
  getReadingProgress,
  getWorkspaceSession,
  saveReadingProgress,
  saveWorkspaceSession
} from '../infra/readingProgressService'
import { getAISettings, normalizeApiKey, saveAISettings, streamChat } from '../llm/aiService'
import {
  disableSkill,
  enableSkill,
  getUserSkillsDir,
  installSkill,
  listSkills,
  reloadSkills,
  setProjectSkillsDir
} from '../skill/skillService'
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
  renamePath
} from '../infra/fileService'
import {
  ensureLocalLibraryDir,
  getLocalLibraryRoot,
  importFilesToLocalLibrary,
  listLocalLibraryFiles
} from '../infra/localLibraryService'
import {
  deleteWebSnapshot,
  getWebSnapshotMetaByPdfPath,
  listWebSnapshots,
  saveWebSnapshot
} from '../web/webSnapshotService'
import { logWebDiagnostics, probeWebUrl, runWebDiagnostics } from '../web/webDiagnosticsService'
import {
  addWebBookmark,
  addWebHistory,
  addWebPhone,
  clearWebHistory,
  getWebCredentialPassword,
  isWebBookmarked,
  listWebBookmarks,
  listWebCredentials,
  listWebCredentialsForOrigin,
  listWebHistory,
  listWebPhones,
  removeWebBookmark,
  removeWebCredential,
  removeWebHistory,
  removeWebPhone,
  saveWebCredential
} from '../web/webLibraryService'
import {
  attachWebGuest,
  destroyWebGuest,
  destroyWebGuestDoc,
  detachWebGuest,
  getWebGuestCount,
  getWebGuestNavigation,
  getWebGuestState,
  getWebGuestUrl,
  navigateWebGuest,
  openWebGuestDevTools,
  prepareWebGuestDoc,
  reloadWebGuest,
  selectAllWebGuest,
  findInWebGuest,
  stopFindInWebGuest,
  setWebGuestBounds,
  webGuestGoBack,
  webGuestGoForward
} from '../web/webGuestService'
import type { SaveWebCredentialInput } from '../../shared/webLibrary'
import { registerHitlIpc } from '../hitl/HitlToolRegistry'

export function registerAllHandlers(): void {
  const ctx = getAppContext()
  if (ctx.hitlRegistry) registerHitlIpc(ipcMain, ctx.hitlRegistry)

  ipcRegistry.register(IPC.window.minimize, () => ctx.mainWindow?.minimize())
  ipcRegistry.register(IPC.window.maximize, () => {
    if (!ctx.mainWindow) return
    if (ctx.mainWindow.isMaximized()) ctx.mainWindow.unmaximize()
    else ctx.mainWindow.maximize()
  })
  ipcRegistry.register(IPC.window.close, () => ctx.mainWindow?.close())
  ipcRegistry.register(IPC.window.isMaximized, () => ctx.mainWindow?.isMaximized() ?? false)

  ipcRegistry.register(IPC.system.getMemory, async () =>
    buildFullMemorySnapshot(getWebGuestCount())
  )

  ipcRegistry.register(IPC.readingProgress.get, async (docPath: unknown) =>
    getReadingProgress(String(docPath))
  )
  ipcRegistry.register(IPC.readingProgress.save, async (progress: unknown) =>
    saveReadingProgress(progress as Parameters<typeof saveReadingProgress>[0])
  )
  ipcRegistry.register(IPC.workspaceSession.get, async () => getWorkspaceSession())
  ipcRegistry.register(IPC.workspaceSession.save, async (session: unknown) => {
    await saveWorkspaceSession(session as Parameters<typeof saveWorkspaceSession>[0])
  })

  ipcRegistry.register(IPC.dialog.openFile, async () => {
    const result = await dialog.showOpenDialog(ctx.mainWindow!, {
      properties: ['openFile'],
      filters: [{ name: 'Documents', extensions: ['txt', 'md', 'pdf', 'docx'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    ctx.setWorkspaceRoot(dirname(filePath))
    return { path: filePath, name: getDisplayName(filePath), type: getFileType(filePath) }
  })

  ipcRegistry.register(IPC.dialog.openFolder, async () => {
    const result = await dialog.showOpenDialog(ctx.mainWindow!, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const folderPath = result.filePaths[0]
    ctx.setWorkspaceRoot(folderPath)
    const files = await collectFilesFromDirectory(folderPath)
    return { path: folderPath, files }
  })

  ipcRegistry.register(IPC.dialog.importFiles, async (targetDir: unknown) => {
    const dir = String(targetDir ?? '')
    if (!dir.trim()) throw new Error('请先打开目标文件夹')
    try {
      await stat(dir)
    } catch {
      throw new Error('目标文件夹不存在，请重新打开文件夹')
    }
    const result = await dialog.showOpenDialog(ctx.mainWindow!, {
      title: '选择要导入的文件',
      defaultPath: dir,
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '文档', extensions: ['txt', 'md', 'pdf', 'docx', 'doc'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { imported: [], canceled: true }
    const imported = await importFilesToDirectory(dir, result.filePaths)
    return { imported, canceled: false }
  })

  ipcRegistry.register(IPC.localLibrary.list, async () => listLocalLibraryFiles())
  ipcRegistry.register(IPC.localLibrary.getPath, async () => getLocalLibraryRoot())
  ipcRegistry.register(IPC.localLibrary.import, async () => {
    const root = await ensureLocalLibraryDir()
    const result = await dialog.showOpenDialog(ctx.mainWindow!, {
      title: '上传文件到本地库',
      defaultPath: root,
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '文档', extensions: ['txt', 'md', 'pdf', 'docx', 'doc'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { imported: [], canceled: true }
    return { imported: await importFilesToLocalLibrary(result.filePaths), canceled: false }
  })

  ipcRegistry.register(IPC.dialog.saveMarkdown, async (content: unknown, defaultName: unknown) => {
    const result = await dialog.showSaveDialog(ctx.mainWindow!, {
      defaultPath: String(defaultName ?? 'export.md'),
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, String(content ?? ''), 'utf-8')
    return true
  })

  ipcRegistry.register(IPC.fs.listDirectory, async (dirPath: unknown) => listDirectory(String(dirPath)))
  ipcRegistry.register(IPC.fs.readText, async (filePath: unknown) => readTextFile(String(filePath)))
  ipcRegistry.register(IPC.fs.readBinary, async (filePath: unknown) => {
    const data = await readBinaryFile(String(filePath))
    return data
  })
  ipcRegistry.register(IPC.fs.getFileInfo, async (filePath: unknown) => {
    const p = String(filePath)
    return {
      path: p,
      name: getDisplayName(p),
      type: getFileType(p),
      supported: isSupportedDocumentPath(p)
    }
  })
  ipcRegistry.register(IPC.fs.createFile, async (dirPath: unknown, fileName: unknown) => {
    const filePath = await createFile(String(dirPath), String(fileName))
    return { path: filePath, name: getDisplayName(filePath), type: getFileType(filePath) }
  })
  ipcRegistry.register(IPC.fs.createFolder, async (dirPath: unknown, folderName: unknown) => {
    const folderPath = await createDirectory(String(dirPath), String(folderName))
    return { path: folderPath, name: getDisplayName(folderPath), isDirectory: true }
  })
  ipcRegistry.register(IPC.fs.delete, async (targetPath: unknown) => {
    await deletePath(String(targetPath))
    return true
  })
  ipcRegistry.register(IPC.fs.rename, async (targetPath: unknown, newName: unknown) => {
    const newPath = await renamePath(String(targetPath), String(newName))
    return {
      path: newPath,
      name: getDisplayName(newPath),
      type: getFileType(newPath),
      supported: isSupportedDocumentPath(newPath)
    }
  })
  ipcRegistry.register(IPC.fs.getDocumentContext, async (filePath: unknown) =>
    getDocumentContext(String(filePath))
  )

  ipcRegistry.register(IPC.annotations.list, async (docPath: unknown) =>
    listAnnotations(String(docPath))
  )
  ipcRegistry.register(IPC.annotations.create, async (input: unknown) =>
    createAnnotation(input as Omit<Annotation, 'id' | 'createdAt'>)
  )
  ipcRegistry.register(IPC.annotations.update, async (id: unknown, patch: unknown) =>
    updateAnnotation(String(id), patch as Partial<Annotation>)
  )
  ipcRegistry.register(IPC.annotations.delete, async (id: unknown) => deleteAnnotation(String(id)))
  ipcRegistry.register(IPC.annotations.export, async (docPath: unknown) =>
    exportAnnotationsMarkdown(String(docPath))
  )

  ipcRegistry.register(IPC.settings.get, async () => {
    const settings = await getAISettings()
    return { ...settings, apiKey: settings.apiKey ? '********' : '' }
  })
  ipcRegistry.register(IPC.settings.getRaw, async () => getAISettings())
  ipcRegistry.register(IPC.settings.save, async (settings: unknown) => {
    const s = settings as AISettings
    const current = await getAISettings()
    const rawKey =
      s.apiKey === '********' || !s.apiKey.trim() ? current.apiKey : s.apiKey
    const next: AISettings = {
      provider: s.provider || current.provider,
      baseUrl: s.baseUrl,
      model: s.model,
      apiKey: normalizeApiKey(rawKey),
      enableThinking: s.enableThinking
    }
    if (!next.apiKey) throw new Error('API 密钥不能为空')
    await saveAISettings(next)
    return true
  })

  ipcRegistry.register(IPC.appSettings.get, async () => getAppSettings())
  ipcRegistry.register(IPC.appSettings.save, async (settings: unknown) => {
    await saveAppSettings(settings as AppSettings)
    return true
  })

  ipcRegistry.register(IPC.skills.list, async () => listSkills())
  ipcRegistry.register(IPC.skills.enable, async (name: unknown) => {
    await enableSkill(String(name))
    return true
  })
  ipcRegistry.register(IPC.skills.disable, async (name: unknown) => {
    await disableSkill(String(name))
    return true
  })
  ipcRegistry.register(IPC.skills.reload, async () => {
    await reloadSkills()
    return listSkills()
  })
  ipcRegistry.register(IPC.skills.install, async () => {
    const result = await dialog.showOpenDialog(ctx.mainWindow!, {
      title: '选择 Skill 文件夹',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const name = await installSkill(result.filePaths[0])
    return { name, skills: await listSkills() }
  })
  ipcRegistry.register(IPC.skills.openDir, async () => {
    const dir = getUserSkillsDir()
    await shell.openPath(dir)
    return dir
  })
  ipcRegistry.register(IPC.skills.setProjectDir, async (rootFolder: unknown) => {
    const root = rootFolder ? String(rootFolder).trim() : null
    setProjectSkillsDir(root || null)
    ctx.setWorkspaceRoot(root)
    await reloadSkills()
    await ctx.mcpManager.startAll(ctx.toolRegistry)
    return listSkills()
  })

  registerAiHandlers()
  registerWebHandlers()
  registerMcpHandlers()

  ipcRegistry.register(IPC.backend.getStatus, async () => getBackendStatus())
}

function registerAiHandlers(): void {
  const ctx = getAppContext()

  ipcMain.handle(
    IPC.ai.chat,
    async (
      event: IpcMainInvokeEvent,
      requestId: unknown,
      messages: unknown,
      contextText?: unknown,
      documentContext?: unknown,
      chatMode?: unknown,
      excludedSkills?: unknown
    ) => {
      const reqId = String(requestId)
      const controller = new AbortController()
      ctx.activeAiAborts.set(reqId, controller)

      const msgList = messages as Array<{ role: string; content: string }>
      const mode = (chatMode as import('../../shared/types').ChatMode | undefined) ?? 'chat'
      const docCtx = documentContext as { fileName: string; content: string } | undefined

      try {
        if (mode === 'agent') {
          if (!ctx.agent) {
            const message = '智能体未初始化，请重启应用后重试'
            event.sender.send(IPC.ai.streamError, reqId, message)
            return { ok: false, error: message }
          }
          const result = await ctx.agent.runTurn(
            {
              messages: msgList as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
              contextText: contextText ? String(contextText) : undefined,
              documentContext: docCtx,
              excludedSkills: excludedSkills as string[] | undefined,
              chatRequestId: reqId
            },
            {
              onChunk: (chunk) => event.sender.send(IPC.ai.streamChunk, reqId, chunk),
              onToolStart: (toolCallId, name, args) =>
                event.sender.send(IPC.ai.toolStart, reqId, toolCallId, name, args),
              onToolDone: (toolCallId, name, output, error) =>
                event.sender.send(IPC.ai.toolDone, reqId, toolCallId, name, output, error)
            },
            controller.signal
          )
          event.sender.send(IPC.ai.streamDone, reqId, result.text, result.activeSkills)
          return { ok: true, activeSkills: result.activeSkills }
        }

        const result = await streamChat(
          {
            messages: msgList as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
            contextText: contextText ? String(contextText) : undefined,
            documentContext: docCtx,
            chatMode: mode,
            excludedSkills: excludedSkills as string[] | undefined
          },
          (chunk) => event.sender.send(IPC.ai.streamChunk, reqId, chunk),
          controller.signal
        )
        event.sender.send(IPC.ai.streamDone, reqId, result.text, result.activeSkills)
        return { ok: true, activeSkills: result.activeSkills }
      } catch (err) {
        if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
          event.sender.send(IPC.ai.streamAborted, reqId)
          return { ok: true, aborted: true }
        }
        const message = err instanceof Error ? err.message : 'AI 请求失败'
        event.sender.send(IPC.ai.streamError, reqId, message)
        return { ok: false, error: message }
      } finally {
        ctx.activeAiAborts.delete(reqId)
      }
    }
  )

  ipcRegistry.register(IPC.ai.abort, async (requestId: unknown) => {
    const reqId = String(requestId)
    ctx.activeAiAborts.get(reqId)?.abort()
    ctx.activeAiAborts.delete(reqId)
    ctx.hitlRegistry?.rejectAllPending(reqId)
  })
}

function registerWebHandlers(): void {
  ipcRegistry.register(IPC.web.openExternal, async (url: unknown) => {
    const trimmed = String(url ?? '').trim()
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

  ipcRegistry.register(IPC.web.saveSnapshot, async (input: unknown) =>
    saveWebSnapshot(input as Parameters<typeof saveWebSnapshot>[0])
  )
  ipcRegistry.register(IPC.web.listSnapshots, async () => listWebSnapshots())
  ipcRegistry.register(IPC.web.getSnapshotMeta, async (pdfPath: unknown) =>
    getWebSnapshotMetaByPdfPath(String(pdfPath))
  )
  ipcRegistry.register(IPC.web.deleteSnapshot, async (id: unknown) => deleteWebSnapshot(String(id)))
  ipcRegistry.register(IPC.web.runDiagnostics, async () => {
    const report = await runWebDiagnostics()
    logWebDiagnostics(report)
    return report
  })
  ipcRegistry.register(IPC.web.probeUrl, async (url: unknown) => probeWebUrl(String(url)))

  ipcRegistry.register(IPC.webLibrary.listHistory, async () => listWebHistory())
  ipcRegistry.register(IPC.webLibrary.addHistory, async (url: unknown, title: unknown) =>
    addWebHistory(String(url), String(title))
  )
  ipcRegistry.register(IPC.webLibrary.removeHistory, async (id: unknown) =>
    removeWebHistory(String(id))
  )
  ipcRegistry.register(IPC.webLibrary.clearHistory, async () => clearWebHistory())
  ipcRegistry.register(IPC.webLibrary.listBookmarks, async () => listWebBookmarks())
  ipcRegistry.register(IPC.webLibrary.addBookmark, async (url: unknown, title: unknown) =>
    addWebBookmark(String(url), String(title))
  )
  ipcRegistry.register(IPC.webLibrary.removeBookmark, async (id: unknown) =>
    removeWebBookmark(String(id))
  )
  ipcRegistry.register(IPC.webLibrary.isBookmarked, async (url: unknown) =>
    isWebBookmarked(String(url))
  )
  ipcRegistry.register(IPC.webLibrary.listCredentials, async () => listWebCredentials())
  ipcRegistry.register(IPC.webLibrary.listCredentialsForOrigin, async (origin: unknown) =>
    listWebCredentialsForOrigin(String(origin))
  )
  ipcRegistry.register(IPC.webLibrary.saveCredential, async (input: unknown) => {
    const credentials = await saveWebCredential(input as SaveWebCredentialInput)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.webLibrary.credentialsChanged, credentials)
    }
    return credentials
  })
  ipcRegistry.register(IPC.webLibrary.removeCredential, async (id: unknown) => {
    const credentials = await removeWebCredential(String(id))
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.webLibrary.credentialsChanged, credentials)
    }
    return credentials
  })
  ipcRegistry.register(IPC.webLibrary.getCredentialPassword, async (id: unknown) =>
    getWebCredentialPassword(String(id))
  )
  ipcRegistry.register(IPC.webLibrary.listPhones, async () => listWebPhones())
  ipcRegistry.register(IPC.webLibrary.addPhone, async (phone: unknown, origin?: unknown) => {
    const phones = await addWebPhone(String(phone), origin ? String(origin) : undefined)
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.webLibrary.phonesChanged, phones)
    }
    return phones
  })
  ipcRegistry.register(IPC.webLibrary.removePhone, async (id: unknown) => {
    const phones = await removeWebPhone(String(id))
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.webLibrary.phonesChanged, phones)
    }
    return phones
  })

  ipcRegistry.register(IPC.webGuest.prepareDoc, async (docId: unknown, url: unknown) => {
    prepareWebGuestDoc(String(docId), url ? String(url) : undefined)
    return { ok: true }
  })
  ipcRegistry.register(IPC.webGuest.attach, async (docId: unknown, bounds: unknown, url: unknown) => {
    const started = attachWebGuest(
      String(docId),
      bounds as Parameters<typeof attachWebGuest>[1],
      url ? String(url) : undefined
    )
    return { ok: true, url: getWebGuestUrl(), started, ...getWebGuestNavigation() }
  })
  ipcRegistry.register(IPC.webGuest.detach, async () => {
    detachWebGuest()
    return { ok: true }
  })
  ipcRegistry.register(IPC.webGuest.destroy, async () => {
    destroyWebGuest()
    return { ok: true }
  })
  ipcRegistry.register(IPC.webGuest.destroyDoc, async (docId: unknown) => {
    destroyWebGuestDoc(String(docId))
    return { ok: true }
  })
  ipcRegistry.register(IPC.webGuest.setBounds, async (bounds: unknown) => {
    setWebGuestBounds(bounds as Parameters<typeof setWebGuestBounds>[0])
    return { ok: true }
  })
  ipcRegistry.register(IPC.webGuest.navigate, async (docId: unknown, url: unknown) => {
    const started = navigateWebGuest(String(docId), String(url))
    return { ok: true, url: getWebGuestUrl(), started }
  })
  ipcRegistry.register(IPC.webGuest.back, async () => ({ ok: webGuestGoBack() }))
  ipcRegistry.register(IPC.webGuest.forward, async () => ({ ok: webGuestGoForward() }))
  ipcRegistry.register(IPC.webGuest.reload, async () => {
    reloadWebGuest()
    return { ok: true }
  })
  ipcRegistry.register(IPC.webGuest.selectAll, async () => {
    selectAllWebGuest()
    return { ok: true }
  })
  ipcRegistry.register(IPC.webGuest.findInPage, async (text: unknown, forward: unknown) => {
    findInWebGuest(String(text ?? ''), forward !== false)
    return { ok: true }
  })
  ipcRegistry.register(IPC.webGuest.stopFindInPage, async () => {
    stopFindInWebGuest()
    return { ok: true }
  })
  ipcRegistry.register(IPC.webGuest.getState, async () => getWebGuestState())
  ipcRegistry.register(IPC.webGuest.openDevTools, async () => {
    openWebGuestDevTools()
    return { ok: true }
  })
}

function registerMcpHandlers(): void {
  const ctx = getAppContext()
  ipcRegistry.register(IPC.mcp.list, async () => ctx.mcpManager.listStates())
  ipcRegistry.register(IPC.mcp.restart, async (serverId: unknown) => {
    await ctx.mcpManager.restart(String(serverId), ctx.toolRegistry)
    return ctx.mcpManager.listStates()
  })
  ipcRegistry.register(IPC.mcp.toggle, async (serverId: unknown, enabled: unknown) => {
    await ctx.mcpManager.toggle(String(serverId), Boolean(enabled), ctx.toolRegistry)
    return ctx.mcpManager.listStates()
  })
}