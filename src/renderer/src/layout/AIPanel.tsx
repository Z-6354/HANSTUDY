import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronRight,
  FileText,
  History,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Pause,
  Send,
  StickyNote,
  Trash2,
  X
} from 'lucide-react'
import { estimateTokens, getContextWindowForModel, getSystemPromptForMode } from '../../../shared/chatModes'
import { getModelMeta } from '../../../shared/aiProviders'
import { AskAIHint } from '../annotations/SelectionToolbar'
import { AIMessageBubble } from '../components/AIMessageBubble'
import { ChatModeSelector } from '../components/ChatModeSelector'
import { ContextUsageRing } from '../components/ContextUsageRing'
import { IconButton } from '../components/IconButton'
import { useChatStore } from '../stores/chatStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { AISettings } from '../types/global.d'

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatSessionTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function AIPanel(): JSX.Element {
  const {
    documents,
    activeDocumentId,
    selection,
    aiDraft,
    setAiDraft,
    chatAttachedDoc,
    chatDocContext,
    attachDocumentToChat,
    detachDocumentFromChat,
    closeAIPanel
  } = useWorkspaceStore()

  const activeDoc = documents.find((d) => d.id === activeDocumentId)

  const {
    sessions,
    activeSessionId,
    messagesByDoc,
    showHistory,
    addMessage,
    updateMessage,
    clearSession,
    createSession,
    switchSession,
    deleteSession,
    toggleHistory,
    setSessionMode,
    streamingId,
    setStreamingId
  } = useChatStore()

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const chatMode = activeSession?.mode ?? 'chat'
  const messages = messagesByDoc[activeSessionId] ?? []

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef<string | null>(null)
  const streamingIdRef = useRef<string | null>(null)
  const activeSessionIdRef = useRef(activeSessionId)
  const abortedRef = useRef(false)
  const [insertFeedback, setInsertFeedback] = useState<string | null>(null)
  const [activeSkills, setActiveSkills] = useState<Array<{ name: string; description: string }>>([])
  const [enabledSkills, setEnabledSkills] = useState<Array<{ name: string; description: string }>>([])
  const [excludedSkills, setExcludedSkills] = useState<string[]>([])

  useEffect(() => {
    streamingIdRef.current = streamingId
  }, [streamingId])

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
  }, [activeSessionId])

  useEffect(() => {
    window.api.settings.getRaw().then(setAiSettings)
    void window.api.skills.list().then((list) => {
      setEnabledSkills(
        list
          .filter((skill) => skill.enabled)
          .map((skill) => ({ name: skill.name, description: skill.description }))
      )
    })
  }, [])

  useEffect(() => {
    if (aiDraft) {
      setInput(aiDraft)
      setAiDraft('')
    }
  }, [aiDraft, setAiDraft])

  const contextUsage = useMemo(() => {
    const modelId = aiSettings?.model ?? 'deepseek-v4-flash'
    const meta = getModelMeta(modelId)
    const maxTokens = meta?.contextWindow ?? getContextWindowForModel(modelId)

    let text = getSystemPromptForMode(chatMode)
    if (chatDocContext) {
      text += `\n${chatDocContext}`
    }
    if (selection?.text) {
      text += `\n${selection.text}`
    }
    for (const msg of messages) {
      text += `\n${msg.content}`
    }
    if (input.trim()) {
      text += `\n${input}`
    }

    return {
      usedTokens: estimateTokens(text),
      maxTokens
    }
  }, [
    aiSettings?.model,
    chatMode,
    chatDocContext,
    selection?.text,
    messages,
    input
  ])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [messages, loading, activeSessionId])

  useEffect(() => {
    const offChunk = window.api.ai.onStreamChunk((requestId, chunk) => {
      const streamId = streamingIdRef.current
      const sessionId = activeSessionIdRef.current
      if (requestId !== requestIdRef.current || !streamId) return
      const current = useChatStore.getState().messagesByDoc[sessionId]?.find(
        (m) => m.id === streamId
      )
      updateMessage(sessionId, streamId, (current?.content ?? '') + chunk)
    })
    const offDone = window.api.ai.onStreamDone((requestId, _full, skills) => {
      if (requestId !== requestIdRef.current) return
      if (skills?.length) setActiveSkills(skills)
      setLoading(false)
      setStreamingId(null)
      requestIdRef.current = null
      abortedRef.current = false
    })
    const offAborted = window.api.ai.onStreamAborted((requestId) => {
      if (requestId !== requestIdRef.current) return
      setLoading(false)
      setStreamingId(null)
      requestIdRef.current = null
      abortedRef.current = false
    })
    const offError = window.api.ai.onStreamError((requestId, err) => {
      if (requestId !== requestIdRef.current || abortedRef.current) return
      const assistantId = streamingIdRef.current
      const sessionId = activeSessionIdRef.current
      if (assistantId) {
        updateMessage(sessionId, assistantId, err, { isError: true })
      }
      setLoading(false)
      setStreamingId(null)
      requestIdRef.current = null
    })
    return () => {
      offChunk()
      offDone()
      offAborted()
      offError()
    }
  }, [setStreamingId, updateMessage])

  const handleAttachActiveDoc = async (): Promise<void> => {
    if (!activeDoc || activeDoc.type === 'settings' || activeDoc.type === 'web' || attaching) return
    setAttaching(true)
    setAttachError(null)
    try {
      const ctx = await window.api.fs.getDocumentContext(activeDoc.path)
      attachDocumentToChat(activeDoc.path, activeDoc.name, ctx.content)
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : '无法读取文档内容')
    } finally {
      setAttaching(false)
    }
  }

  const handleSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text || loading) return

    setAttachError(null)
    setLoading(true)
    abortedRef.current = false

    const selectionText = selection?.text || undefined

    const userMsg = {
      id: genId(),
      role: 'user' as const,
      content: text,
      createdAt: new Date().toISOString(),
      contextText: selectionText
    }
    addMessage(activeSessionId, userMsg)
    setInput('')

    const assistantId = genId()
    addMessage(activeSessionId, {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString()
    })
    setStreamingId(assistantId)

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
    const requestId = genId()
    requestIdRef.current = requestId

    const documentContext =
      chatAttachedDoc && chatDocContext
        ? { fileName: chatAttachedDoc.name, content: chatDocContext }
        : undefined

    try {
      await window.api.ai.chat(
        requestId,
        history,
        selectionText,
        documentContext,
        chatMode,
        excludedSkills
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : '发送失败'
      updateMessage(activeSessionId, assistantId, message, { isError: true })
      setLoading(false)
      setStreamingId(null)
      requestIdRef.current = null
    }
  }

  const handleInsertNote = async (content: string): Promise<void> => {
    const noteDocPath =
      chatAttachedDoc?.path ??
      (activeDoc?.type !== 'settings' && activeDoc?.type !== 'web' ? activeDoc?.path : undefined)
    if (!noteDocPath || !content.trim()) return
    setInsertFeedback(null)
    try {
      await window.api.annotations.create({
        docPath: noteDocPath,
        type: 'note',
        color: '#ffd500',
        selectedText: selection?.text,
        content: content.trim(),
        range: selection?.range
      })
      useWorkspaceStore.getState().notifyAnnotationsChanged()
      setInsertFeedback('已插入便签')
      window.setTimeout(() => setInsertFeedback(null), 2000)
    } catch (err) {
      setInsertFeedback(err instanceof Error ? err.message : '插入便签失败')
    }
  }

  const handlePause = (): void => {
    if (!loading || !requestIdRef.current) return
    abortedRef.current = true
    void window.api.ai.abort(requestIdRef.current)
    setLoading(false)
    setStreamingId(null)
    requestIdRef.current = null
  }

  const toggleExcludedSkill = (name: string): void => {
    setExcludedSkills((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    )
  }

  const canInsertNote = !!(
    chatAttachedDoc?.path ??
    (activeDoc?.type !== 'settings' && activeDoc?.type !== 'web' ? activeDoc?.path : undefined)
  )
  const readableActiveDoc =
    activeDoc && activeDoc.type !== 'settings' && activeDoc.type !== 'web' ? activeDoc : null

  return (
    <div className={`ai-panel ${showHistory ? 'with-history' : ''}`}>
      {showHistory && (
        <div className="ai-history-panel">
          <div className="ai-history-header">
            <span>历史对话</span>
            <IconButton icon={X} label="关闭历史" onClick={toggleHistory} />
          </div>
          <div className="ai-history-list">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`ai-history-item ${session.id === activeSessionId ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className="ai-history-item-main"
                  onClick={() => switchSession(session.id)}
                >
                  <span className="ai-history-title">{session.title}</span>
                  <span className="ai-history-time">{formatSessionTime(session.updatedAt)}</span>
                </button>
                <IconButton
                  icon={Trash2}
                  label="删除对话"
                  size={14}
                  className="ai-history-delete"
                  onClick={() => deleteSession(session.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ai-panel-main">
        <div className="ai-panel-header">
          <span>AI 助手</span>
          <div className="ai-panel-actions">
            <IconButton icon={MessageSquarePlus} label="新增对话" onClick={() => createSession()} />
            <IconButton
              icon={History}
              label="历史对话"
              active={showHistory}
              onClick={toggleHistory}
            />
            <IconButton
              icon={Trash2}
              label="清空当前对话"
              onClick={() => clearSession(activeSessionId)}
            />
            <IconButton
              icon={ChevronRight}
              label="收起 AI 助手"
              size={14}
              className="ai-panel-collapse-btn"
              onClick={closeAIPanel}
            />
          </div>
        </div>

        <div className="ai-context-bar">
          {chatAttachedDoc ? (
            <div className="ai-context-chip">
              <FileText size={14} aria-hidden />
              <span>{chatAttachedDoc.name}</span>
              <IconButton icon={X} label="移出对话" size={14} onClick={detachDocumentFromChat} />
            </div>
          ) : readableActiveDoc ? (
            <IconButton
              icon={attaching ? Loader2 : Paperclip}
              label={
                attaching
                  ? '读取中...'
                  : `将「${readableActiveDoc.name}」加入对话`
              }
              className={`ai-attach-btn ${attaching ? 'spinning' : ''}`}
              disabled={attaching}
              onClick={() => void handleAttachActiveDoc()}
            />
          ) : (
            <span className="ai-context-hint">未加入文档，可直接对话</span>
          )}
          {attachError && <span className="ai-context-error">{attachError}</span>}
          {insertFeedback && <span className="ai-insert-feedback">{insertFeedback}</span>}
        </div>

        <AskAIHint />

        <div className="ai-panel-body" ref={bodyRef}>
          {messages.length === 0 && (
            <p className="ai-placeholder">
              无需打开文档即可提问。打开文件后，可点击上方按钮将文档加入对话。
            </p>
          )}
          {messages.map((msg) => (
            <AIMessageBubble
              key={msg.id}
              role={msg.role === 'user' ? 'user' : 'assistant'}
              content={msg.content}
              isError={msg.isError}
              isStreaming={msg.role === 'assistant' && msg.id === streamingId && loading}
            >
              {msg.role === 'assistant' && msg.id === streamingId && loading && !msg.isError && (
                <IconButton
                  icon={Pause}
                  label="暂停生成"
                  className="ai-pause-btn"
                  size={14}
                  onClick={handlePause}
                />
              )}
              {msg.role === 'assistant' && msg.content && !loading && !msg.isError && canInsertNote && (
                <IconButton
                  icon={StickyNote}
                  label="插入便签"
                  className="ai-insert-btn"
                  size={14}
                  onClick={() => void handleInsertNote(msg.content)}
                />
              )}
            </AIMessageBubble>
          ))}
        </div>

        <div className="ai-panel-input">
          {(enabledSkills.length > 0 || activeSkills.length > 0) && (
            <div className="ai-skill-bar">
              {(enabledSkills.length ? enabledSkills : activeSkills).map((skill) => {
                const isActive = activeSkills.some((item) => item.name === skill.name)
                const isExcluded = excludedSkills.includes(skill.name)
                return (
                  <button
                    key={skill.name}
                    type="button"
                    className={`ai-skill-chip ${isActive ? 'active' : ''} ${isExcluded ? 'excluded' : ''}`}
                    title={skill.description}
                    onClick={() => toggleExcludedSkill(skill.name)}
                  >
                    {skill.name}
                    {isExcluded ? '（已跳过）' : ''}
                  </button>
                )
              })}
              {excludedSkills.length > 0 && (
                <button
                  type="button"
                  className="ai-skill-reset"
                  onClick={() => setExcludedSkills([])}
                >
                  恢复全部
                </button>
              )}
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入问题... Enter 发送，Shift+Enter 换行"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && loading) {
                e.preventDefault()
                handlePause()
                return
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
          />
          <div className="ai-input-footer">
            <ChatModeSelector
              mode={chatMode}
              onChange={(mode) => setSessionMode(activeSessionId, mode)}
            />
            <div className="ai-input-actions">
              <ContextUsageRing
                usedTokens={contextUsage.usedTokens}
                maxTokens={contextUsage.maxTokens}
              />
              {loading ? (
                <IconButton
                  icon={Pause}
                  label="暂停生成"
                  className="secondary-btn icon-action-btn ai-pause-action"
                  onClick={handlePause}
                />
              ) : (
                <IconButton
                  icon={Send}
                  label="发送"
                  className="primary-btn icon-action-btn"
                  disabled={!input.trim()}
                  onClick={() => void handleSend()}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
