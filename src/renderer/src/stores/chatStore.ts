import { create } from 'zustand'
import type { ChatMode } from '../../../shared/types'
import type { ChatMessage } from '../types/global.d'

const CHAT_KEY = 'hanstudy-chat-history'
const SESSIONS_KEY = 'hanstudy-chat-sessions'

export const GLOBAL_CHAT_SESSION = '__global__'

export interface ChatSession {
  id: string
  title: string
  mode: ChatMode
  createdAt: string
  updatedAt: string
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
      updatedAt: s.updatedAt ?? new Date().toISOString()
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
          updatedAt: legacy[legacy.length - 1]?.createdAt ?? new Date().toISOString()
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
          updatedAt: new Date().toISOString()
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
  streamingId: string | null
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
  createSession: () => string
  switchSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  setShowHistory: (show: boolean) => void
  toggleHistory: () => void
  setSessionMode: (sessionId: string, mode: ChatMode) => void
  setStreamingId: (id: string | null) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: boot.sessions,
  activeSessionId: boot.activeSessionId,
  messagesByDoc: boot.messagesByDoc,
  streamingId: null,
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

  createSession: () => {
    const id = genSessionId()
    const session: ChatSession = {
      id,
      title: '新对话',
      mode: 'chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
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

  deleteSession: (sessionId) => {
    set((state) => {
      if (state.sessions.length <= 1) {
        get().clearSession(sessionId)
        const sessions = state.sessions.map((s) =>
          s.id === sessionId
            ? { ...s, title: '新对话', updatedAt: new Date().toISOString() }
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

      let activeSessionId = state.activeSessionId
      if (activeSessionId === sessionId) {
        activeSessionId = sessions[0]?.id ?? activeSessionId
      }
      return { sessions, messagesByDoc, activeSessionId }
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

  setStreamingId: (id) => set({ streamingId: id })
}))
