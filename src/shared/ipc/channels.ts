/** IPC channel 常量 — 主进程与 preload 共用 */

export const IPC = {
  window: {
    minimize: 'window:minimize',
    maximize: 'window:maximize',
    close: 'window:close',
    isMaximized: 'window:isMaximized',
    resetPageZoom: 'window:resetPageZoom',
    maximizedChanged: 'window:maximized-changed'
  },
  system: {
    getMemory: 'system:getMemory'
  },
  readingProgress: {
    get: 'readingProgress:get',
    save: 'readingProgress:save',
    listIndex: 'readingProgress:listIndex'
  },
  fileFavorites: {
    list: 'fileFavorites:list',
    toggle: 'fileFavorites:toggle',
    remove: 'fileFavorites:remove',
    rename: 'fileFavorites:rename'
  },
  workspaceSession: {
    get: 'workspaceSession:get',
    save: 'workspaceSession:save'
  },
  dialog: {
    openFile: 'dialog:openFile',
    openFolder: 'dialog:openFolder',
    openImage: 'dialog:openImage',
    importFiles: 'dialog:importFiles',
    saveMarkdown: 'dialog:saveMarkdown',
    saveJson: 'dialog:saveJson',
    openJson: 'dialog:openJson'
  },
  localLibrary: {
    list: 'localLibrary:list',
    getPath: 'localLibrary:getPath',
    isPath: 'localLibrary:isPath',
    import: 'localLibrary:import'
  },
  fs: {
    listDirectory: 'fs:listDirectory',
    readText: 'fs:readText',
    writeText: 'fs:writeText',
    readBinary: 'fs:readBinary',
    getFileInfo: 'fs:getFileInfo',
    createFile: 'fs:createFile',
    createFolder: 'fs:createFolder',
    delete: 'fs:delete',
    rename: 'fs:rename',
    getDocumentContext: 'fs:getDocumentContext',
    getAiChatDocumentContext: 'fs:getAiChatDocumentContext'
  },
  notes: {
    getRoot: 'notes:getRoot',
    list: 'notes:list',
    read: 'notes:read',
    write: 'notes:write',
    append: 'notes:append',
    createFile: 'notes:createFile',
    createFolder: 'notes:createFolder',
    delete: 'notes:delete',
    rename: 'notes:rename'
  },
  documentNotes: {
    get: 'documentNotes:get',
    save: 'documentNotes:save'
  },
  notebooks: {
    list: 'notebooks:list',
    get: 'notebooks:get',
    save: 'notebooks:save',
    create: 'notebooks:create',
    rename: 'notebooks:rename',
    delete: 'notebooks:delete',
    linkDoc: 'notebooks:linkDoc',
    importLegacy: 'notebooks:importLegacy',
    importNotebook: 'notebooks:importNotebook'
  },
  settings: {
    get: 'settings:get',
    getRaw: 'settings:getRaw',
    save: 'settings:save'
  },
  appSettings: {
    get: 'appSettings:get',
    save: 'appSettings:save'
  },
  feedback: {
    submit: 'feedback:submit'
  },
  agentPaths: {
    setLoadedFolder: 'agentPaths:setLoadedFolder'
  },
  skills: {
    list: 'skills:list',
    enable: 'skills:enable',
    disable: 'skills:disable',
    reload: 'skills:reload',
    install: 'skills:install',
    delete: 'skills:delete',
    openDir: 'skills:openDir',
    setProjectDir: 'skills:setProjectDir'
  },
  ai: {
    chat: 'ai:chat',
    abort: 'ai:abort',
    streamChunk: 'ai:stream-chunk',
    streamDone: 'ai:stream-done',
    streamError: 'ai:stream-error',
    streamAborted: 'ai:stream-aborted',
    toolStart: 'ai:tool-start',
    toolDone: 'ai:tool-done',
    hitlRequest: 'ai:hitl-request',
    hitlResponse: 'ai:hitl-response'
  },
  web: {
    openExternal: 'web:openExternal',
    runDiagnostics: 'web:runDiagnostics',
    probeUrl: 'web:probeUrl'
  },
  webLibrary: {
    listHistory: 'webLibrary:listHistory',
    addHistory: 'webLibrary:addHistory',
    removeHistory: 'webLibrary:removeHistory',
    clearHistory: 'webLibrary:clearHistory',
    listBookmarks: 'webLibrary:listBookmarks',
    addBookmark: 'webLibrary:addBookmark',
    removeBookmark: 'webLibrary:removeBookmark',
    isBookmarked: 'webLibrary:isBookmarked',
    listCredentials: 'webLibrary:listCredentials',
    listCredentialsForOrigin: 'webLibrary:listCredentialsForOrigin',
    saveCredential: 'webLibrary:saveCredential',
    removeCredential: 'webLibrary:removeCredential',
    getCredentialPassword: 'webLibrary:getCredentialPassword',
    listPhones: 'webLibrary:listPhones',
    addPhone: 'webLibrary:addPhone',
    removePhone: 'webLibrary:removePhone',
    credentialsChanged: 'webLibrary:credentialsChanged',
    phonesChanged: 'webLibrary:phonesChanged'
  },
  webGuest: {
    prepareDoc: 'webGuest:prepareDoc',
    attach: 'webGuest:attach',
    detach: 'webGuest:detach',
    destroy: 'webGuest:destroy',
    destroyDoc: 'webGuest:destroyDoc',
    setBounds: 'webGuest:setBounds',
    navigate: 'webGuest:navigate',
    back: 'webGuest:back',
    forward: 'webGuest:forward',
    reload: 'webGuest:reload',
    selectAll: 'webGuest:selectAll',
    findInPage: 'webGuest:findInPage',
    stopFindInPage: 'webGuest:stopFindInPage',
    getState: 'webGuest:getState',
    openDevTools: 'webGuest:openDevTools',
    setZoomFactor: 'webGuest:setZoomFactor',
    getZoomFactor: 'webGuest:getZoomFactor',
    event: 'webGuest:event'
  },
  mcp: {
    list: 'mcp:list',
    toggle: 'mcp:toggle',
    restart: 'mcp:restart'
  },
  backend: {
    getStatus: 'backend:getStatus'
  },
  screenshot: {
    pickRegion: 'screenshot:pickRegion',
    submit: 'screenshot:submit',
    cancel: 'screenshot:cancel',
    init: 'screenshot:init',
    ready: 'screenshot:ready'
  },
  app: {
    getEnvironment: 'app:getEnvironment'
  },
  logs: {
    getInfo: 'logs:getInfo',
    readAuditRecent: 'logs:readAuditRecent',
    readAppLogRecent: 'logs:readAppLogRecent',
    openDir: 'logs:openDir'
  }
} as const
