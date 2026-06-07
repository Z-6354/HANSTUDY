import Editor from '@monaco-editor/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NOTE_EDITOR_OPTIONS } from '../reader/viewers/monacoEditorOptions'

interface NoteEditorProps {
  filePath: string | null
  onSaved?: () => void
}

const SAVE_DEBOUNCE_MS = 800

export function NoteEditor({ filePath, onSaved }: NoteEditorProps): JSX.Element {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef(content)
  contentRef.current = content

  useEffect(() => {
    if (!filePath) {
      setContent('')
      setError(null)
      setDirty(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    void window.api.notes
      .read(filePath)
      .then((text) => {
        if (!cancelled) {
          setContent(text)
          setDirty(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || '无法读取笔记')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filePath])

  const flushSave = useCallback(async (): Promise<void> => {
    if (!filePath || !dirty) return
    try {
      await window.api.notes.write(filePath, contentRef.current)
      setDirty(false)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }, [filePath, dirty, onSaved])

  const scheduleSave = useCallback((): void => {
    if (!filePath) return
    setDirty(true)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void flushSave()
    }, SAVE_DEBOUNCE_MS)
  }, [filePath, flushSave])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      void flushSave()
    }
  }, [filePath, flushSave])

  if (!filePath) {
    return (
      <div className="note-editor-empty">
        <p>在左侧笔记库选择或新建笔记</p>
      </div>
    )
  }

  if (loading) return <div className="loading-state">加载笔记...</div>
  if (error) return <div className="error-state">{error}</div>

  return (
    <div className="note-editor">
      <Editor
        height="100%"
        defaultLanguage="markdown"
        theme="vs-dark"
        value={content}
        onChange={(value) => {
          setContent(value ?? '')
          scheduleSave()
        }}
        options={NOTE_EDITOR_OPTIONS}
      />
    </div>
  )
}
