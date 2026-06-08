import { Bold, Code, Eye, Palette, Send, Type, Underline } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { IconButton } from '../../components/IconButton'
import { isBodyEmpty, noteBodyToVisualHtml, visualHtmlToNoteBody } from './noteComposerContent'
import {
  NOTE_FONT_SIZES,
  NOTE_HIGHLIGHT_COLORS,
  NOTE_TEXT_COLORS,
  wrapNoteFontSize,
  wrapNoteHighlight,
  wrapNoteTextColor
} from './noteComposerFormat'
import {
  applyBold,
  applyFontSize,
  applyHighlight,
  applyTextColor,
  applyUnderline,
  focusEditor,
  caretComposerBlockKind,
  exitComposerBlockEdit,
  findActiveComposerBlock,
  replaceSlashCommandVisual,
  textBeforeCursor
} from './noteComposerRich'
import {
  applySlashTemplate,
  filterSlashCommands,
  parseSlashAtCursor,
  trySlashCompleteOnSpace,
  type NoteSlashCommand
} from './noteSlashCommands'

type ComposerInputMode = 'visual' | 'source'

interface NoteComposerProps {
  disabled?: boolean
  onSubmit: (markdown: string) => void
  variant?: 'default' | 'inline'
  onCancel?: () => void
  placeholder?: string
  submitLabel?: string
}

function wrapSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string
): { next: string; cursor: number } {
  const selected = value.slice(selectionStart, selectionEnd)
  const next = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd)
  const cursor = selectionStart + before.length + selected.length + after.length
  return { next, cursor }
}

export function NoteComposer({
  disabled,
  onSubmit,
  variant = 'default',
  onCancel,
  placeholder = '记录笔记… 输入 /daima、/dm 等唤起块命令',
  submitLabel = '添加笔记'
}: NoteComposerProps): JSX.Element {
  const [body, setBody] = useState('')
  const [inputMode, setInputMode] = useState<ComposerInputMode>('visual')
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [slashIndex, setSlashIndex] = useState(0)
  const [fontSize, setFontSize] = useState(NOTE_FONT_SIZES[1]!.value)
  const [colorMenu, setColorMenu] = useState<'text' | 'highlight' | null>(null)
  const [blockEditing, setBlockEditing] = useState(false)

  const visualRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef<HTMLTextAreaElement>(null)
  const colorMenuRef = useRef<HTMLDivElement>(null)
  const inputWrapRef = useRef<HTMLDivElement>(null)
  const skipVisualSyncRef = useRef(false)
  const skipSlashDetectRef = useRef(false)

  const slashItems = filterSlashCommands(slashQuery)
  const isInline = variant === 'inline'

  const closeSlash = useCallback((): void => {
    setSlashOpen(false)
    setSlashQuery('')
    setSlashIndex(0)
  }, [])

  const syncBodyFromVisual = useCallback((): void => {
    const el = visualRef.current
    if (!el) return
    setBody(visualHtmlToNoteBody(el.innerHTML))
  }, [])

  const refreshBlockEditing = useCallback((): void => {
    setBlockEditing(caretComposerBlockKind(visualRef.current) != null)
  }, [])

  const tryExitBlockEdit = useCallback((): boolean => {
    const visual = visualRef.current
    if (!visual || inputMode !== 'visual') return false
    if (!exitComposerBlockEdit(visual)) return false
    syncBodyFromVisual()
    setBlockEditing(false)
    return true
  }, [inputMode, syncBodyFromVisual])

  const applyVisualHtml = useCallback((html: string): void => {
    const el = visualRef.current
    if (!el) return
    skipVisualSyncRef.current = true
    el.innerHTML = html
    skipVisualSyncRef.current = false
  }, [])

  const switchInputMode = useCallback(
    (mode: ComposerInputMode): void => {
      if (mode === inputMode) return
      if (mode === 'source') {
        if (visualRef.current) {
          setBody(visualHtmlToNoteBody(visualRef.current.innerHTML))
        }
      } else {
        applyVisualHtml(noteBodyToVisualHtml(body))
      }
      setInputMode(mode)
      closeSlash()
    },
    [applyVisualHtml, body, closeSlash, inputMode]
  )

  const applySourceFormat = useCallback(
    (before: string, after: string): void => {
      const el = sourceRef.current
      if (!el) return
      const { next, cursor } = wrapSelection(body, el.selectionStart, el.selectionEnd, before, after)
      setBody(next)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(cursor, cursor)
      })
    },
    [body]
  )

  const applySourceWrapped = useCallback(
    (wrap: (selected: string) => string): void => {
      const el = sourceRef.current
      if (!el) return
      const start = el.selectionStart
      const end = el.selectionEnd
      const selected = body.slice(start, end)
      const wrapped = wrap(selected)
      const next = body.slice(0, start) + wrapped + body.slice(end)
      setBody(next)
      requestAnimationFrame(() => {
        el.focus()
        const cursor =
          start === end
            ? start + Math.max(0, wrapped.indexOf('</'))
            : start + wrapped.length
        el.setSelectionRange(cursor, cursor)
      })
    },
    [body]
  )

  const handleBold = useCallback((): void => {
    if (inputMode === 'visual') {
      focusEditor(visualRef.current)
      applyBold()
      syncBodyFromVisual()
      return
    }
    applySourceFormat('**', '**')
  }, [applySourceFormat, inputMode, syncBodyFromVisual])

  const handleUnderline = useCallback((): void => {
    if (inputMode === 'visual') {
      focusEditor(visualRef.current)
      applyUnderline()
      syncBodyFromVisual()
      return
    }
    applySourceFormat('<u>', '</u>')
  }, [applySourceFormat, inputMode, syncBodyFromVisual])

  const handleFontSize = useCallback((): void => {
    if (inputMode === 'visual') {
      focusEditor(visualRef.current)
      applyFontSize(fontSize)
      syncBodyFromVisual()
      return
    }
    applySourceWrapped((s) => wrapNoteFontSize(fontSize, s))
  }, [applySourceWrapped, fontSize, inputMode, syncBodyFromVisual])

  const handleTextColor = useCallback(
    (color: string): void => {
      if (inputMode === 'visual') {
        focusEditor(visualRef.current)
        applyTextColor(color)
        syncBodyFromVisual()
      } else {
        applySourceWrapped((s) => wrapNoteTextColor(color, s))
      }
      setColorMenu(null)
    },
    [applySourceWrapped, inputMode, syncBodyFromVisual]
  )

  const handleHighlightColor = useCallback(
    (color: string): void => {
      if (inputMode === 'visual') {
        focusEditor(visualRef.current)
        applyHighlight(color)
        syncBodyFromVisual()
      } else {
        applySourceWrapped((s) => wrapNoteHighlight(color, s))
      }
      setColorMenu(null)
    },
    [applySourceWrapped, inputMode, syncBodyFromVisual]
  )

  const detectSlash = useCallback(
    (before: string): void => {
      const ctx = parseSlashAtCursor(before)
      if (ctx) {
        setSlashOpen(true)
        setSlashQuery(ctx.query)
        setSlashIndex(0)
      } else {
        closeSlash()
      }
    },
    [closeSlash]
  )

  const applySlashAt = useCallback(
    (cmd: NoteSlashCommand, slashStart: number, replaceEnd: number): void => {
      if (inputMode === 'visual') {
        const el = visualRef.current
        if (!el) return
        replaceSlashCommandVisual(el, slashStart, cmd, replaceEnd)
        syncBodyFromVisual()
        requestAnimationFrame(refreshBlockEditing)
      } else {
        const { text: template, cursorOffset } = applySlashTemplate(cmd.template)
        const el = sourceRef.current
        if (!el) return
        const next = body.slice(0, slashStart) + template + body.slice(replaceEnd)
        setBody(next)
        requestAnimationFrame(() => {
          el.focus()
          const pos = slashStart + cursorOffset
          el.setSelectionRange(pos, pos)
        })
      }
      closeSlash()
    },
    [body, closeSlash, inputMode, refreshBlockEditing, syncBodyFromVisual]
  )

  const pickSlashCommand = useCallback(
    (cmd: NoteSlashCommand): void => {
      if (inputMode === 'visual') {
        const el = visualRef.current
        if (!el) return
        const before = textBeforeCursor(el)
        const ctx = parseSlashAtCursor(before)
        if (!ctx) return
        applySlashAt(cmd, ctx.slashStart, before.length)
        return
      }
      const el = sourceRef.current
      if (!el) return
      const before = body.slice(0, el.selectionStart)
      const ctx = parseSlashAtCursor(before)
      if (!ctx) return
      applySlashAt(cmd, ctx.slashStart, el.selectionStart)
    },
    [applySlashAt, body, inputMode]
  )

  const handleSlashInput = useCallback(
    (before: string, replaceEnd: number): void => {
      if (skipSlashDetectRef.current) {
        skipSlashDetectRef.current = false
        closeSlash()
        return
      }

      const completed = trySlashCompleteOnSpace(before)
      if (completed) {
        applySlashAt(completed.command, completed.slashStart, replaceEnd)
        return
      }

      detectSlash(before)
    },
    [applySlashAt, closeSlash, detectSlash]
  )

  const handleVisualInput = useCallback((): void => {
    if (skipVisualSyncRef.current) return
    const el = visualRef.current
    if (!el) return
    syncBodyFromVisual()
    refreshBlockEditing()
    const before = textBeforeCursor(el)
    handleSlashInput(before, before.length)
  }, [handleSlashInput, refreshBlockEditing, syncBodyFromVisual])

  const handleSourceChange = useCallback(
    (value: string): void => {
      setBody(value)
      const el = sourceRef.current
      if (!el) return
      handleSlashInput(value.slice(0, el.selectionStart), el.selectionStart)
    },
    [handleSlashInput]
  )

  const markSlashDetectSkipped = useCallback((): void => {
    skipSlashDetectRef.current = true
  }, [])

  const readBodyForSubmit = useCallback((): string => {
    if (inputMode === 'visual' && visualRef.current) {
      return visualHtmlToNoteBody(visualRef.current.innerHTML).trim()
    }
    return body.trim()
  }, [body, inputMode])

  const handleSubmit = useCallback((): void => {
    const trimmed = readBodyForSubmit()
    if (!trimmed || disabled || isBodyEmpty(trimmed)) return
    onSubmit(trimmed)
    setBody('')
    if (visualRef.current) visualRef.current.innerHTML = ''
    closeSlash()
  }, [closeSlash, disabled, onSubmit, readBodyForSubmit])

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement | HTMLDivElement>): void => {
      if (slashOpen && slashItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSlashIndex((i) => (i + 1) % slashItems.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSlashIndex((i) => (i - 1 + slashItems.length) % slashItems.length)
          return
        }
        if (e.key === 'Enter' && !e.shiftKey && !(e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          pickSlashCommand(slashItems[slashIndex]!)
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          closeSlash()
          return
        }
        if (e.key === 'ArrowRight') {
          closeSlash()
          return
        }
      }

      if (e.key === 'Escape' && inputMode === 'visual' && tryExitBlockEdit()) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (inputMode === 'visual') {
          document.execCommand('insertLineBreak')
          syncBodyFromVisual()
        } else {
          const el = sourceRef.current
          if (!el) return
          const start = el.selectionStart
          const end = el.selectionEnd
          setBody(body.slice(0, start) + '\n' + body.slice(end))
          requestAnimationFrame(() => {
            el.focus()
            el.setSelectionRange(start + 1, start + 1)
          })
        }
        return
      }

      if (e.key === 'Enter' && !e.shiftKey && !(e.ctrlKey || e.metaKey)) {
        if (inputMode === 'visual' && caretComposerBlockKind(visualRef.current)) {
          e.preventDefault()
          document.execCommand('insertLineBreak')
          syncBodyFromVisual()
          return
        }
        e.preventDefault()
        handleSubmit()
      }
    },
    [
      body,
      closeSlash,
      handleSubmit,
      inputMode,
      pickSlashCommand,
      slashIndex,
      slashItems,
      slashOpen,
      syncBodyFromVisual,
      tryExitBlockEdit
    ]
  )

  useEffect(() => {
    if (inputMode !== 'visual') {
      setBlockEditing(false)
      return
    }
    const onSelectionChange = (): void => refreshBlockEditing()
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [inputMode, refreshBlockEditing])

  useEffect(() => {
    if (inputMode !== 'visual' || !blockEditing) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (!caretComposerBlockKind(visualRef.current)) return
      if (tryExitBlockEdit()) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [blockEditing, inputMode, tryExitBlockEdit])

  useEffect(() => {
    if (slashIndex >= slashItems.length) setSlashIndex(0)
  }, [slashIndex, slashItems.length])

  useEffect(() => {
    if (!colorMenu) return
    const onPointerDown = (e: MouseEvent): void => {
      if (colorMenuRef.current?.contains(e.target as Node)) return
      setColorMenu(null)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [colorMenu])

  useEffect(() => {
    if (!slashOpen) return
    const onPointerDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (inputWrapRef.current?.contains(target)) return
      closeSlash()
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [closeSlash, slashOpen])

  useEffect(() => {
    if (inputMode === 'visual' && body === '' && visualRef.current) {
      visualRef.current.innerHTML = ''
    }
  }, [body, inputMode])

  const canSubmit = !isBodyEmpty(body)

  return (
    <div className={`doc-note-composer${isInline ? ' doc-note-composer--inline' : ''}`}>
      <div className="doc-note-composer-toolbar">
        <div className="doc-note-composer-mode">
          <IconButton
            icon={Eye}
            label="可视化"
            size={14}
            className={inputMode === 'visual' ? 'active' : ''}
            active={inputMode === 'visual'}
            disabled={disabled}
            onClick={() => switchInputMode('visual')}
          />
          <IconButton
            icon={Code}
            label="Markdown 源码"
            size={14}
            className={inputMode === 'source' ? 'active' : ''}
            active={inputMode === 'source'}
            disabled={disabled}
            onClick={() => switchInputMode('source')}
          />
        </div>
        <IconButton
          icon={Bold}
          label="加粗"
          size={14}
          disabled={disabled}
          onClick={handleBold}
        />
        <IconButton
          icon={Underline}
          label="下划线"
          size={14}
          disabled={disabled}
          onClick={handleUnderline}
        />
        <div className="doc-note-format-font">
          <Type size={13} aria-hidden />
          <select
            className="doc-note-font-select"
            value={fontSize}
            disabled={disabled}
            aria-label="字号"
            onChange={(e) => setFontSize(e.target.value)}
          >
            {NOTE_FONT_SIZES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="doc-note-font-apply"
            disabled={disabled}
            onClick={handleFontSize}
          >
            应用
          </button>
        </div>
        <div className="doc-note-format-color" ref={colorMenuRef}>
          <IconButton
            icon={Palette}
            label="文字颜色"
            size={14}
            disabled={disabled}
            className={colorMenu === 'text' ? 'active' : ''}
            onClick={() => setColorMenu((m) => (m === 'text' ? null : 'text'))}
          />
          {colorMenu === 'text' && (
            <div className="doc-note-color-menu" role="menu">
              {NOTE_TEXT_COLORS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  role="menuitem"
                  className="doc-note-color-item"
                  title={opt.label}
                  onClick={() => handleTextColor(opt.value)}
                >
                  {opt.value ? (
                    <span className="doc-note-color-swatch" style={{ backgroundColor: opt.value }} />
                  ) : (
                    <span className="doc-note-color-default">A</span>
                  )}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="doc-note-highlight-btn"
            disabled={disabled}
            title="高亮背景"
            aria-label="高亮背景"
            onClick={() => setColorMenu((m) => (m === 'highlight' ? null : 'highlight'))}
          >
            H
          </button>
          {colorMenu === 'highlight' && (
            <div className="doc-note-color-menu" role="menu">
              {NOTE_HIGHLIGHT_COLORS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  role="menuitem"
                  className="doc-note-color-item"
                  title={opt.label}
                  onClick={() => handleHighlightColor(opt.value)}
                >
                  <span className="doc-note-color-swatch" style={{ backgroundColor: opt.value }} />
                </button>
              ))}
            </div>
          )}
        </div>
        {!isInline && (
          <span className="doc-note-composer-hint">
            {inputMode === 'visual'
              ? '可视化输入 · 工具栏即时生效 · Enter 发送 · Ctrl+Enter 换行'
              : 'Markdown 源码 · 输入 / 唤起命令 · Enter 发送'}
          </span>
        )}
      </div>

      <div className="doc-note-composer-input-wrap" ref={inputWrapRef}>
        {slashOpen && slashItems.length > 0 && (
          <ul className="doc-note-slash-menu" role="listbox">
            {slashItems.map((cmd, idx) => (
              <li key={cmd.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={idx === slashIndex}
                  className={`doc-note-slash-item${idx === slashIndex ? ' active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pickSlashCommand(cmd)
                  }}
                >
                  <span className="doc-note-slash-label">{cmd.label}</span>
                  <span className="doc-note-slash-desc">{cmd.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {inputMode === 'visual' ? (
          <>
            <div
              ref={visualRef}
              className="doc-note-composer-visual markdown-body"
              contentEditable={!disabled}
              role="textbox"
              aria-multiline="true"
              aria-placeholder={placeholder}
              data-placeholder={placeholder}
              suppressContentEditableWarning
              onPaste={markSlashDetectSkipped}
              onInput={handleVisualInput}
              onMouseDown={(e) => {
                if (slashOpen) closeSlash()
                if (!blockEditing) return
                const el = visualRef.current
                if (!el) return
                const block = findActiveComposerBlock(el)
                if (!block || block.contains(e.target as Node)) return
                const rect = block.getBoundingClientRect()
                if (e.clientY >= rect.bottom - 4 || e.target === el) {
                  e.preventDefault()
                  tryExitBlockEdit()
                }
              }}
              onKeyDown={handleKeyDown}
            />
            {blockEditing && (
              <div
                className="doc-note-composer-block-exit-pad"
                role="presentation"
                onMouseDown={(e) => {
                  e.preventDefault()
                  tryExitBlockEdit()
                }}
              />
            )}
          </>
        ) : (
          <textarea
            ref={sourceRef}
            className="doc-note-composer-textarea"
            placeholder={placeholder}
            value={body}
            disabled={disabled}
            rows={isInline ? 3 : 4}
            onPaste={markSlashDetectSkipped}
            onChange={(e) => handleSourceChange(e.target.value)}
            onClick={() => {
              if (slashOpen) closeSlash()
            }}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>

      <div className="doc-note-composer-actions">
        {isInline && onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            取消
          </button>
        )}
        <button
          type="button"
          className="btn-primary doc-note-composer-submit"
          disabled={disabled || !canSubmit}
          onClick={handleSubmit}
        >
          <Send size={14} />
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
