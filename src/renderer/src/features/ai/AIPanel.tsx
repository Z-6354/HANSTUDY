import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  Loader2,
  MessageSquarePlus,
  NotebookPen,
  Paperclip,
  Pause,
  Send,
  StickyNote,
  Trash2,
  X
} from 'lucide-react'
import { estimateTokens, getContextWindowForModel, getSystemPromptForMode } from '@shared/chatModes'
import { getModelMeta } from '@shared/aiProviders'
import { AskAIHint } from '../reader/selection/SelectionToolbar'
import { navigateToChatContextItem, prepareLayoutChangeForNoteFocus } from '../notes/navigateToNoteEntry'
import type { ChatContextItem, ChatContextSnapshot } from '@shared/aiContext'
import {
  canNavigateContextSnapshot,
  collectSessionContextNotes,
  formatContextChipLabel,
  mergeChatContextItems,
  snapshotChatContextItems,
  snapshotToContextItem
} from '@shared/aiContext'
import {
  findPrecedingUserMessage,
  formatAiExchangeNoteMarkdown,
  formatAiSessionNoteMarkdown
} from '@shared/aiNoteMarkdown'
import type { SavedDocumentType } from '@shared/readingProgress'
import type { AISettings, ChatMessage } from '../../types/global.d'
import { AIMessageBubble } from './AIMessageBubble'
import { ChatModeSelector } from './ChatModeSelector'
import { AISkillMenu } from './AISkillMenu'
import { ContextUsageRing } from './ContextUsageRing'
import { HitlApprovalModal } from './HitlApprovalModal'
import { ToolCallBubble, type ToolStep } from './ToolCallBubble'
import { IconButton } from '../../components/IconButton'
import { useChatStore } from '../../stores/chatStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'

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

function formatContextLabels(items?: ChatContextSnapshot[]): string[] {
  if (!items?.length) return []
  return items.map((item) => formatContextChipLabel(item))
}

function attachDocSavedType(type: string): SavedDocumentType {
  if (type === 'txt' || type === 'md' || type === 'pdf' || type === 'docx' || type === 'web') {
    return type
  }
  return 'unknown'
}

export function AIPanel(): JSX.Element {
  const {
    documents,
    activeDocumentId,
    selection,
    aiDraft,
    setAiDraft,
    chatContextItems,
    addChatContextItem,
    removeChatContextItem,
    clearChatContextItems,
    getMergedChatContext,
    requestNoteInsert,
    openAIPanel,
    closeAIPanel,
    dispatchReaderNavigate
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
    startStream,
    finishStream,
    getStream,
    updateStreamToolSteps,
    isSessionStreaming,
    toggleExcludedSkill,
    switchSessionForDoc
  } = useChatStore()

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const chatMode = activeSession?.mode ?? 'chat'
  const messages = messagesByDoc[activeSessionId] ?? []
  const activeStream = useChatStore((s) => s.activeStreams[activeSessionId])
  const globalExcludedSkills = useChatStore((s) => s.globalExcludedSkills)
  const isStreamingActiveSession = isSessionStreaming(activeSessionId)

  const [input, setInput] = useState('')
  const [attachError, setAttachError] = useState<string | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null)
  const [historyContextMenu, setHistoryContextMenu] = useState<{
    x: number
    y: number
    sessionId: string
  } | null>(null)
  const [messageContextMenu, setMessageContextMenu] = useState<{
    x: number
    y: number
    messageId: string
  } | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const abortedRequestsRef = useRef<Set<string>>(new Set())
  const [enabledSkills, setEnabledSkills] = useState<Array<{ name: string; description: string }>>([])
  const [hitlQueue, setHitlQueue] = useState<
    Array<{
      chatRequestId: string
      hitlRequestId: string
      toolName: string
      args: Record<string, unknown>
    }>
  >([])
  const hitlPending = hitlQueue[0] ?? null

  const mergedContext = getMergedChatContext()
  const mergedContextText = mergedContext?.content ?? ''

  const drainHitlForRequest = (requestId: string): void => {
    setHitlQueue((q) => q.filter((h) => h.chatRequestId !== requestId))
  }

  useEffect(() => {
    if (!activeDoc || activeDoc.type === 'settings' || activeDoc.type === 'web') return
    switchSessionForDoc(activeDoc.path, activeDoc.name)
  }, [activeDoc?.path, activeDoc?.type, activeDoc?.name, switchSessionForDoc])

  useEffect(() => {
    window.api.settings.getRaw().then(setAiSettings)
    const refreshSkills = (): void => {
      void window.api.skills.list().then((list) => {
        setEnabledSkills(
          list
            .filter((skill) => skill.enabled)
            .map((skill) => ({ name: skill.name, description: skill.description }))
        )
      })
    }
    refreshSkills()
    window.addEventListener('focus', refreshSkills)
    return () => window.removeEventListener('focus', refreshSkills)
  }, [])

  useEffect(() => {
    if (aiDraft) {
      setInput(aiDraft)
      setAiDraft('')
    }
  }, [aiDraft, setAiDraft])

  useEffect(() => {
    if (!historyContextMenu && !messageContextMenu) return
    const close = (): void => {
      setHistoryContextMenu(null)
      setMessageContextMenu(null)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [historyContextMenu, messageContextMenu])

  const contextUsage = useMemo(() => {
    const modelId = aiSettings?.model ?? 'deepseek-v4-flash'
    const meta = getModelMeta(modelId)
    const maxTokens = meta?.contextWindow ?? getContextWindowForModel(modelId)

    let text = getSystemPromptForMode(chatMode)
    if (mergedContextText) {
      text += `\n${mergedContextText}`
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
    mergedContextText,
    selection?.text,
    messages,
    input
  ])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [messages, activeStream, activeSessionId])

  useEffect(() => {
    const offChunk = window.api.ai.onStreamChunk((requestId, chunk) => {
      const sessionId = useChatStore.getState().getSessionForRequest(requestId)
      const stream = sessionId ? useChatStore.getState().getStream(sessionId) : undefined
      if (!sessionId || !stream || stream.requestId !== requestId) return
      const current = useChatStore.getState().messagesByDoc[sessionId]?.find(
        (m) => m.id === stream.assistantId
      )
      updateMessage(sessionId, stream.assistantId, (current?.content ?? '') + chunk)
    })
    const offDone = window.api.ai.onStreamDone((requestId) => {
      const sessionId = useChatStore.getState().getSessionForRequest(requestId)
      if (!sessionId) return
      finishStream(requestId)
      abortedRequestsRef.current.delete(requestId)
    })
    const offAborted = window.api.ai.onStreamAborted((requestId) => {
      if (!useChatStore.getState().getSessionForRequest(requestId)) return
      drainHitlForRequest(requestId)
      finishStream(requestId)
      abortedRequestsRef.current.delete(requestId)
    })
    const offError = window.api.ai.onStreamError((requestId, err) => {
      if (abortedRequestsRef.current.has(requestId)) return
      const sessionId = useChatStore.getState().getSessionForRequest(requestId)
      const stream = sessionId ? useChatStore.getState().getStream(sessionId) : undefined
      if (!sessionId || !stream) return
      updateMessage(sessionId, stream.assistantId, err, { isError: true })
      finishStream(requestId)
    })
    const offToolStart = window.api.ai.onToolStart((requestId, toolCallId, name) => {
      const sessionId = useChatStore.getState().getSessionForRequest(requestId)
      if (!sessionId) return
      updateStreamToolSteps(sessionId, (prev) => [
        ...prev,
        { id: toolCallId, name, status: 'running' }
      ])
    })
    const offToolDone = window.api.ai.onToolDone((requestId, toolCallId, name, output, error) => {
      const sessionId = useChatStore.getState().getSessionForRequest(requestId)
      if (!sessionId) return
      updateStreamToolSteps(sessionId, (prev) => {
        const idx = prev.findIndex((s) => s.id === toolCallId)
        if (idx < 0) {
          return [
            ...prev,
            {
              id: toolCallId,
              name,
              status: error ? 'error' : 'done',
              output,
              error
            }
          ]
        }
        const next = [...prev]
        next[idx] = {
          ...next[idx],
          status: error ? 'error' : 'done',
          output,
          error
        }
        return next
      })
    })
    const offHitl = window.api.ai.onHitlRequest((chatRequestId, hitlRequestId, toolName, args) => {
      setHitlQueue((prev) => [...prev, { chatRequestId, hitlRequestId, toolName, args }])
    })
    return () => {
      offChunk()
      offDone()
      offAborted()
      offError()
      offToolStart()
      offToolDone()
      offHitl()
    }
  }, [activeSessionId, finishStream, updateMessage, updateStreamToolSteps])

  const attachableDoc =
    activeDoc &&
    activeDoc.type !== 'settings' &&
    activeDoc.type !== 'web' &&
    (activeDoc.type === 'txt' || activeDoc.type === 'md')
      ? activeDoc
      : null

  const handleAttachActiveDoc = async (): Promise<void> => {
    if (!attachableDoc || attaching) return
    setAttaching(true)
    setAttachError(null)
    try {
      const progress = await window.api.readingProgress.get(attachableDoc.path)
      const ctx = await window.api.fs.getAiChatDocumentContext(attachableDoc.path, {
        monacoLine: progress?.monacoLine,
        scrollRatio: progress?.scrollRatio
      })
      const hint = ctx.sectionTitle ? `章节：${ctx.sectionTitle}` : undefined
      addChatContextItem({
        kind: 'document',
        label: attachableDoc.name,
        content: ctx.content,
        hint,
        docPath: attachableDoc.path,
        anchor: {
          docPath: attachableDoc.path,
          docType: attachDocSavedType(attachableDoc.type),
          docName: attachableDoc.name,
          monacoLine: progress?.monacoLine,
          scrollRatio: progress?.scrollRatio
        }
      })
      openAIPanel()
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : '无法读取文档内容')
    } finally {
      setAttaching(false)
    }
  }

  const handleContextChipNavigate = (item: ChatContextItem): void => {
    void navigateToChatContextItem(item, dispatchReaderNavigate).catch((err: Error) => {
      setAttachError(err.message || '无法跳转到笔记')
    })
  }

  const handleSnapshotNavigate = (item: ChatContextSnapshot): void => {
    handleContextChipNavigate(snapshotToContextItem(item))
  }

  const handleHistoryNoteNavigate = (
    sessionId: string,
    note: ChatContextSnapshot,
    e: MouseEvent
  ): void => {
    e.preventDefault()
    e.stopPropagation()
    prepareLayoutChangeForNoteFocus()
    if (sessionId !== activeSessionId) switchSession(sessionId)
    handleSnapshotNavigate(note)
  }

  const canNavigateContextItem = (item: ChatContextItem): boolean =>
    canNavigateContextSnapshot(item)

  const buildAssistantNoteMarkdown = (assistantMsg: ChatMessage): string => {
    const userMsg = findPrecedingUserMessage(messages, assistantMsg.id)
    const session = sessions.find((s) => s.id === activeSessionId)
    return formatAiExchangeNoteMarkdown({
      question: userMsg?.content,
      answer: assistantMsg.content,
      sessionTitle: session?.title,
      contextLabels: formatContextLabels(userMsg?.contextItems)
    })
  }

  const handleInsertAssistantToNote = (assistantMsg: ChatMessage): void => {
    if (!assistantMsg.content.trim()) return
    const session = sessions.find((s) => s.id === activeSessionId)
    requestNoteInsert(
      buildAssistantNoteMarkdown(assistantMsg),
      session?.title ?? 'AI 对话',
      activeSessionId
    )
  }

  const handleInsertSessionToNote = (sessionId: string): void => {
    const session = sessions.find((s) => s.id === sessionId)
    const sessionMessages = messagesByDoc[sessionId] ?? []
    requestNoteInsert(
      formatAiSessionNoteMarkdown(sessionMessages, session?.title),
      session?.title ?? '历史对话',
      sessionId
    )
  }

  const handleSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text || isStreamingActiveSession) return

    setAttachError(null)
    abortedRequestsRef.current.delete('')

    const selectionText = selection?.text || undefined

    const sessionId = activeSessionId

    const sentContextItems = chatContextItems
    const contextSnapshot = snapshotChatContextItems(sentContextItems)
    const documentContext = mergeChatContextItems(sentContextItems)

    const userMsg = {
      id: genId(),
      role: 'user' as const,
      content: text,
      createdAt: new Date().toISOString(),
      contextText: selectionText,
      contextItems: contextSnapshot.length > 0 ? contextSnapshot : undefined
    }
    addMessage(sessionId, userMsg)
    setInput('')
    if (sentContextItems.length > 0) clearChatContextItems()

    const assistantId = genId()
    addMessage(sessionId, {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString()
    })

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
    const requestId = genId()
    startStream(sessionId, requestId, assistantId)

    try {
      await window.api.ai.chat(
        requestId,
        history,
        selectionText,
        documentContext,
        chatMode,
        globalExcludedSkills
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : '发送失败'
      updateMessage(sessionId, assistantId, message, { isError: true })
      finishStream(requestId)
    }
  }

  const handleInsertToNote = (assistantMsg: ChatMessage): void => {
    handleInsertAssistantToNote(assistantMsg)
  }

  const handleHistoryContextMenu = (e: MouseEvent, sessionId: string): void => {
    e.preventDefault()
    e.stopPropagation()
    setHistoryContextMenu({ x: e.clientX, y: e.clientY, sessionId })
  }

  const handleMessageContextMenu = (e: MouseEvent, messageId: string): void => {
    e.preventDefault()
    e.stopPropagation()
    setMessageContextMenu({ x: e.clientX, y: e.clientY, messageId })
  }

  const handlePause = (): void => {
    const stream = getStream(activeSessionId)
    if (!stream) return
    abortedRequestsRef.current.add(stream.requestId)
    drainHitlForRequest(stream.requestId)
    void window.api.ai.abort(stream.requestId)
    finishStream(stream.requestId)
  }

  const abortStreamingSession = (sessionId: string): void => {
    const stream = getStream(sessionId)
    if (!stream) return
    abortedRequestsRef.current.add(stream.requestId)
    drainHitlForRequest(stream.requestId)
    void window.api.ai.abort(stream.requestId)
    finishStream(stream.requestId)
  }

  const handleClearSession = (sessionId: string): void => {
    abortStreamingSession(sessionId)
    clearSession(sessionId)
  }

  const handleDeleteSession = (sessionId: string): void => {
    abortStreamingSession(sessionId)
    deleteSession(sessionId)
  }

  const handleSelectHistorySession = (sessionId: string): void => {
    switchSession(sessionId)
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div className="ai-panel-header-main">
          {showHistory ? (
            <>
              <IconButton
                icon={ChevronLeft}
                label="返回对话"
                size={14}
                className="ai-history-back-btn"
                onClick={toggleHistory}
              />
              <span className="ai-panel-title">历史对话</span>
            </>
          ) : (
            <span className="ai-panel-title">AI 助手</span>
          )}
        </div>
        <div className="ai-panel-actions">
          {!showHistory && (
            <>
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
                onClick={() => handleClearSession(activeSessionId)}
              />
            </>
          )}
          <IconButton
            icon={ChevronRight}
            label="收起 AI 助手"
            size={14}
            className="ai-panel-collapse-btn"
            onClick={closeAIPanel}
          />
        </div>
      </div>

      {showHistory ? (
        <div className="ai-history-view">
          <div className="ai-history-list">
            {sessions.length === 0 ? (
              <p className="ai-history-empty">暂无历史对话</p>
            ) : (
              sessions.map((session) => {
              const sessionNotes = collectSessionContextNotes(
                messagesByDoc[session.id] ?? []
              )
              return (
                <div
                  key={session.id}
                  className={`ai-history-item ${session.id === activeSessionId ? 'active' : ''}`}
                  onContextMenu={(e) => handleHistoryContextMenu(e, session.id)}
                >
                  <button
                    type="button"
                    className="ai-history-item-main"
                    onClick={() => handleSelectHistorySession(session.id)}
                  >
                    <span className="ai-history-title">{session.title}</span>
                    {sessionNotes.length > 0 && (
                      <div className="ai-history-notes">
                        {sessionNotes.map((note) => (
                          <button
                            key={note.noteEntryId ?? note.label}
                            type="button"
                            className="ai-history-note-tag"
                            title={`${formatContextChipLabel(note)} · 点击跳转`}
                            onClick={(e) => handleHistoryNoteNavigate(session.id, note, e)}
                          >
                            <StickyNote size={10} aria-hidden />
                            <span>{formatContextChipLabel(note)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <span className="ai-history-time">{formatSessionTime(session.updatedAt)}</span>
                  </button>
                  <IconButton
                    icon={Trash2}
                    label="删除对话"
                    size={14}
                    className="ai-history-delete"
                    onClick={() => handleDeleteSession(session.id)}
                  />
                </div>
              )
            })
            )}
          </div>
        </div>
      ) : (
        <>
          <AskAIHint />

          <div className="ai-panel-body" ref={bodyRef}>
          {messages.length === 0 && (
            <p className="ai-placeholder">
              无需打开文档即可提问。笔记引用可点击跳转到对应笔记本中的笔记节点。
            </p>
          )}
          {messages.map((msg) => {
            const streamingThis =
              msg.role === 'assistant' &&
              msg.id === activeStream?.assistantId &&
              isSessionStreaming(activeSessionId)
            const toolSteps =
              streamingThis && activeStream
                ? (activeStream.toolSteps as ToolStep[])
                : (msg.toolSteps as ToolStep[] | undefined)
            return (
            <AIMessageBubble
              key={msg.id}
              role={msg.role === 'user' ? 'user' : 'assistant'}
              content={msg.content}
              isError={msg.isError}
              isStreaming={streamingThis}
              contextItems={msg.role === 'user' ? msg.contextItems : undefined}
              onContextItemNavigate={
                msg.role === 'user' ? handleSnapshotNavigate : undefined
              }
              onContextMenu={
                msg.role === 'assistant' && msg.content && !streamingThis && !msg.isError
                  ? (e) => handleMessageContextMenu(e, msg.id)
                  : undefined
              }
            >
              {msg.role === 'assistant' &&
                (toolSteps?.length ?? 0) > 0 &&
                !msg.isError && <ToolCallBubble steps={toolSteps!} />}
              {streamingThis && !msg.isError && (
                <IconButton
                  icon={Pause}
                  label="暂停生成"
                  className="ai-pause-btn"
                  size={14}
                  onClick={handlePause}
                />
              )}
              {msg.role === 'assistant' &&
                msg.content &&
                !streamingThis &&
                !msg.isError && (
                <IconButton
                  icon={NotebookPen}
                  label="加入笔记"
                  className="ai-insert-btn"
                  size={14}
                  onClick={() => handleInsertToNote(msg)}
                />
              )}
            </AIMessageBubble>
            )
          })}
        </div>

        <div className="ai-panel-input">
          <div className="ai-composer-bar">
            <div className="ai-composer-toolbar">
              <ChatModeSelector
                mode={chatMode}
                onChange={(mode) => setSessionMode(activeSessionId, mode)}
              />
              <AISkillMenu
                skills={enabledSkills}
                excludedSkills={globalExcludedSkills}
                onToggle={toggleExcludedSkill}
              />
            </div>
            {(chatContextItems.length > 0 || attachableDoc) && (
              <div className="ai-composer-context">
                {chatContextItems.map((item) => {
                  const chipLabel = formatContextChipLabel(item)
                  const chipTitle =
                    item.kind === 'note'
                      ? chipLabel
                      : item.hint
                        ? `${item.label} · ${item.hint}`
                        : item.label
                  const clickable = canNavigateContextItem(item)
                  return (
                    <div
                      key={item.id}
                      className={`ai-context-chip${clickable ? ' ai-context-chip--clickable' : ''}`}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      title={clickable ? `${chipTitle} · 点击跳转` : chipTitle}
                      onClick={
                        clickable
                          ? () => handleContextChipNavigate(item)
                          : undefined
                      }
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                handleContextChipNavigate(item)
                              }
                            }
                          : undefined
                      }
                    >
                      {item.kind === 'note' ? (
                        <StickyNote size={14} aria-hidden />
                      ) : (
                        <FileText size={14} aria-hidden />
                      )}
                      <span>{chipLabel}</span>
                      <IconButton
                        icon={X}
                        label="移出对话"
                        size={14}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeChatContextItem(item.id)
                        }}
                      />
                    </div>
                  )
                })}
                {attachableDoc && (
                  <IconButton
                    icon={attaching ? Loader2 : Paperclip}
                    label={
                      attaching ? '读取中...' : `将「${attachableDoc.name}」当前章节加入对话`
                    }
                    className={`ai-attach-btn ${attaching ? 'spinning' : ''}`}
                    disabled={attaching}
                    onClick={() => void handleAttachActiveDoc()}
                  />
                )}
              </div>
            )}
          </div>
          {attachError && <span className="ai-context-error">{attachError}</span>}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入问题... Enter 发送，Shift+Enter 换行"
            disabled={isStreamingActiveSession}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && isStreamingActiveSession) {
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
            <div className="ai-input-actions">
              <ContextUsageRing
                usedTokens={contextUsage.usedTokens}
                maxTokens={contextUsage.maxTokens}
              />
              {isStreamingActiveSession ? (
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
        </>
      )}

      {historyContextMenu && (
        <div
          className="context-menu ai-history-context-menu"
          style={{ left: historyContextMenu.x, top: historyContextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              handleInsertSessionToNote(historyContextMenu.sessionId)
              setHistoryContextMenu(null)
            }}
          >
            <NotebookPen size={14} />
            加入笔记
          </button>
        </div>
      )}

      {messageContextMenu && (
        <div
          className="context-menu ai-message-context-menu"
          style={{ left: messageContextMenu.x, top: messageContextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              const msg = messages.find((m) => m.id === messageContextMenu.messageId)
              if (msg?.role === 'assistant' && msg.content.trim()) {
                handleInsertAssistantToNote(msg)
              }
              setMessageContextMenu(null)
            }}
          >
            <NotebookPen size={14} />
            加入笔记
          </button>
        </div>
      )}

      {hitlPending && (
        <HitlApprovalModal
          toolName={hitlPending.toolName}
          args={hitlPending.args}
          onRespond={(approved) => {
            window.api.ai.respondHitl(hitlPending.hitlRequestId, approved)
            setHitlQueue((prev) => prev.slice(1))
          }}
        />
      )}
    </div>
  )
}
