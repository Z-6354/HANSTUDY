import { create } from 'zustand'
import type { ChatMode } from '../../../shared/types'
import type { ChatMessage } from '../types/global.d'

const CHAT_KEY = 'hanstudy-chat-history'
const SESSIONS_KEY = 'hanstudy-chat-sessions'

export const GLOBAL_CHAT_SESSION = '__global__'

export interface ChatToolStep {
  id: string
  name: string
  status: 'running' | 'done' | 'error'
  output?: string
  error?: string
}

export interface SessionStreamState {
  requestId: string
  assistantId: string
  toolSteps: ChatToolStep[]
}

export interface ChatSession {
  id: string
  title: string
  mode: ChatMode
  createdAt: string
  updatedAt: string
  docPath?: string | null
  excludedSkills?: string[]
}

function genSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function loadAll(): Record<string, ChatMessage[]> {
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    return raw ? (JSON.parse(raw) as Record<string, ChatMessage[]>) : {}
  } catch {
    return {}
  }
}

function saveAll(data: Record<string, ChatMessage[]>): void {
  localStorage.setItem(CHAT_KEY, JSON.stringify(data))
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    const parsed = raw ? (JSON.parse(raw) as Array<Partial<ChatSession> & { id: string }>) : []
    return parsed.map((s) => ({
      id: s.id,
      title: s.title ?? '新对话',
      mode: s.mode ?? 'chat',
      createdAt: s.createdAt ?? new Date().toISOString(),
      updatedAt: s.updatedAt ?? new Date().toISOString(),
      docPath: s.docPath ?? null,
      excludedSkills: s.excludedSkills ?? []
    }))
  } catch {
    return []
  }
}

function saveSessions(sessions: ChatSession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

function bootstrapSessions(messagesByDoc: Record<string, ChatMessage[]>): {
  sessions: ChatSession[]
  activeSessionId: string
  messagesByDoc: Record<string, ChatMessage[]>
} {
  let sessions = loadSessions()
  const data = { ...messagesByDoc }

  if (sessions.length === 0) {
    const legacy = data[GLOBAL_CHAT_SESSION]
    if (legacy?.length) {
      const id = genSessionId()
      data[id] = legacy
      delete data[GLOBAL_CHAT_SESSION]
      const firstUser = legacy.find((m) => m.role === 'user')
      sessions = [
        {
          id,
          title: firstUser ? firstUser.content.slice(0, 32) : '历史对话',
          mode: 'chat',
          createdAt: legacy[0]?.createdAt ?? new Date().toISOString(),
          updatedAt: legacy[legacy.length - 1]?.createdAt ?? new Date().toISOString(),
          docPath: null,
          excludedSkills: []
        }
      ]
    } else {
      const id = genSessionId()
      sessions = [
        {
          id,
          title: '新对话',
          mode: 'chat',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          docPath: null,
          excludedSkills: []
        }
      ]
    }
    saveSessions(sessions)
    saveAll(data)
  }

  return { sessions, activeSessionId: sessions[0].id, messagesByDoc: data }
}

const boot = bootstrapSessions(loadAll())

interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string
  messagesByDoc: Record<string, ChatMessage[]>
  activeStreams: Record<string, SessionStreamState>
  requestSessionMap: Record<string, string>
  showHistory: boolean
  loadForDoc: (sessionId: string) => ChatMessage[]
  addMessage: (sessionId: string, message: ChatMessage) => void
  updateMessage: (
    sessionId: string,
    id: string,
    content: string,
    options?: { isError?: boolean }
  ) => void
  clearSession: (sessionId: string) => void
  createSession: (docPath?: string | null, title?: string) => string
  switchSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  setShowHistory: (show: boolean) => void
  toggleHistory: () => void
  setSessionMode: (sessionId: string, mode: ChatMode) => void
  getOrCreateSessionForDoc: (docPath: string, docName: string) => string
  switchSessionForDoc: (docPath: string, docName: string) => void
  getExcludedSkills: (sessionId: string) => string[]
  toggleExcludedSkill: (sessionId: string, name: string) => void
  clearExcludedSkills: (sessionId: string) => void
  startStream: (sessionId: string, requestId: string, assistantId: string) => void
  finishStream: (requestId: string) => void
  getSessionForRequest: (requestId: string) => string | undefined
  getStream: (sessionId: string) => SessionStreamState | undefined
  updateStreamToolSteps: (
    sessionId: string,
    updater: (prev: ChatToolStep[]) => ChatToolStep[]
  ) => void
  isSessionStreaming: (sessionId: string) => boolean
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: boot.sessions,
  activeSessionId: boot.activeSessionId,
  messagesByDoc: boot.messagesByDoc,
  activeStreams: {},
  requestSessionMap: {},
  showHistory: false,

  loadForDoc: (sessionId) => get().messagesByDoc[sessionId] ?? [],

  addMessage: (sessionId, message) => {
    set((state) => {
      const list = [...(state.messagesByDoc[sessionId] ?? []), message]
      const messagesByDoc = { ...state.messagesByDoc, [sessionId]: list }
      saveAll(messagesByDoc)

      const now = new Date().toISOString()
      const sessions = state.sessions.map((s) => {
        if (s.id !== sessionId) return s
        let title = s.title
        if (message.role === 'user' && (title === '新对话' || !title.trim())) {
          title = message.content.slice(0, 32) + (message.content.length > 32 ? '…' : '')
        }
        return { ...s, title, updatedAt: now }
      })
      saveSessions(sessions)

      return { messagesByDoc, sessions }
    })
  },

  updateMessage: (sessionId, id, content, options) => {
    set((state) => {
      const list = (state.messagesByDoc[sessionId] ?? []).map((m) => {
        if (m.id !== id) return m
        const next = { ...m, content }
        if (options?.isError !== undefined) {
          next.isError = options.isError
        }
        return next
      })
      const messagesByDoc = { ...state.messagesByDoc, [sessionId]: list }
      saveAll(messagesByDoc)
      return { messagesByDoc }
    })
  },

  clearSession: (sessionId) => {
    set((state) => {
      const messagesByDoc = { ...state.messagesByDoc, [sessionId]: [] }
      saveAll(messagesByDoc)
      return { messagesByDoc }
    })
  },

  createSession: (docPath = null, title = '新对话') => {
    const id = genSessionId()
    const session: ChatSession = {
      id,
      title,
      mode: 'chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      docPath,
      excludedSkills: []
    }
    set((state) => {
      const sessions = [session, ...state.sessions]
      saveSessions(sessions)
      return { sessions, activeSessionId: id, showHistory: false }
    })
    return id
  },

  switchSession: (sessionId) => {
    set({ activeSessionId: sessionId, showHistory: false })
  },

  getOrCreateSessionForDoc: (docPath, docName) => {
    const state = get()
    const existing = state.sessions.find((s) => s.docPath === docPath)
    if (existing) return existing.id
    return get().createSession(docPath, docName)
  },

  switchSessionForDoc: (docPath, docName) => {
    const id = get().getOrCreateSessionForDoc(docPath, docName)
    get().switchSession(id)
  },

  deleteSession: (sessionId) => {
    set((state) => {
      if (state.sessions.length <= 1) {
        get().clearSession(sessionId)
        const sessions = state.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                title: '新对话',
                docPath: null,
                excludedSkills: [],
                updatedAt: new Date().toISOString()
              }
            : s
        )
        saveSessions(sessions)
        return { sessions }
      }

      const sessions = state.sessions.filter((s) => s.id !== sessionId)
      const messagesByDoc = { ...state.messagesByDoc }
      delete messagesByDoc[sessionId]
      saveAll(messagesByDoc)
      saveSessions(sessions)

      const activeStreams = { ...state.activeStreams }
      delete activeStreams[sessionId]

      let activeSessionId = state.activeSessionId
      if (activeSessionId === sessionId) {
        activeSessionId = sessions[0]?.id ?? activeSessionId
      }
      return { sessions, messagesByDoc, activeSessionId, activeStreams }
    })
  },

  setShowHistory: (show) => set({ showHistory: show }),

  toggleHistory: () => set((state) => ({ showHistory: !state.showHistory })),

  setSessionMode: (sessionId, mode) => {
    set((state) => {
      const sessions = state.sessions.map((s) =>
        s.id === sessionId ? { ...s, mode, updatedAt: new Date().toISOString() } : s
      )
      saveSessions(sessions)
      return { sessions }
    })
  },

  getExcludedSkills: (sessionId) => {
    return get().sessions.find((s) => s.id === sessionId)?.excludedSkills ?? []
  },

  toggleExcludedSkill: (sessionId, name) => {
    set((state) => {
      const sessions = state.sessions.map((s) => {
        if (s.id !== sessionId) return s
        const list = s.excludedSkills ?? []
        const excludedSkills = list.includes(name)
          ? list.filter((item) => item !== name)
          : [...list, name]
        return { ...s, excludedSkills }
      })
      saveSessions(sessions)
      return { sessions }
    })
  },

  clearExcludedSkills: (sessionId) => {
    set((state) => {
      const sessions = state.sessions.map((s) =>
        s.id === sessionId ? { ...s, excludedSkills: [] } : s
      )
      saveSessions(sessions)
      return { sessions }
    })
  },

  startStream: (sessionId, requestId, assistantId) => {
    set((state) => ({
      activeStreams: {
        ...state.activeStreams,
        [sessionId]: { requestId, assistantId, toolSteps: [] }
      },
      requestSessionMap: { ...state.requestSessionMap, [requestId]: sessionId }
    }))
  },

  finishStream: (requestId) => {
    set((state) => {
      const sessionId = state.requestSessionMap[requestId]
      if (!sessionId) return state
      const stream = state.activeStreams[sessionId]
      let messagesByDoc = state.messagesByDoc
      if (stream && stream.toolSteps.length > 0) {
        const list = state.messagesByDoc[sessionId] ?? []
        messagesByDoc = {
          ...state.messagesByDoc,
          [sessionId]: list.map((m) =>
            m.id === stream.assistantId ? { ...m, toolSteps: [...stream.toolSteps] } : m
          )
        }
        saveAll(messagesByDoc)
      }
      const activeStreams = { ...state.activeStreams }
      delete activeStreams[sessionId]
      const requestSessionMap = { ...state.requestSessionMap }
      delete requestSessionMap[requestId]
      return { activeStreams, requestSessionMap, messagesByDoc }
    })
  },

  getSessionForRequest: (requestId) => get().requestSessionMap[requestId],

  getStream: (sessionId) => get().activeStreams[sessionId],

  updateStreamToolSteps: (sessionId, updater) => {
    set((state) => {
      const stream = state.activeStreams[sessionId]
      if (!stream) return state
      return {
        activeStreams: {
          ...state.activeStreams,
          [sessionId]: { ...stream, toolSteps: updater(stream.toolSteps) }
        }
      }
    })
  },

  isSessionStreaming: (sessionId) => Boolean(get().activeStreams[sessionId])
}))

