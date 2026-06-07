import { useCallback, useEffect, useRef, useState } from 'react'
import { isLargeFile as checkLargeFile } from '@shared/lazyFile'

const AUTO_SAVE_DEBOUNCE_MS = 600

export interface UseLazyTextFileOptions {
  /** 修改后自动防抖保存（MD 等） */
  autoSave?: boolean
  /** 卸载时若有未保存改动则写入磁盘 */
  flushOnUnmount?: boolean
}

export function useLazyTextFile(
  filePath: string,
  options: UseLazyTextFileOptions = {}
): {
  content: string
  sizeBytes: number
  isLargeFile: boolean
  loading: boolean
  error: string | null
  dirty: boolean
  saving: boolean
  setContent: (next: string) => void
  save: () => Promise<boolean>
  revert: () => void
} {
  const { autoSave = false, flushOnUnmount = false } = options
  const [content, setContentState] = useState('')
  const [sizeBytes, setSizeBytes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef(content)
  const baselineRef = useRef('')
  const dirtyRef = useRef(false)
  contentRef.current = content
  dirtyRef.current = dirty

  const persist = useCallback(
    async (text: string): Promise<boolean> => {
      setSaving(true)
      try {
        await window.api.fs.writeText(filePath, text)
        baselineRef.current = text
        dirtyRef.current = false
        setDirty(false)
        setError(null)
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : '保存失败')
        return false
      } finally {
        setSaving(false)
      }
    },
    [filePath]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setDirty(false)
    dirtyRef.current = false

    void window.api.fs
      .readText(filePath)
      .then((result) => {
        if (cancelled) return
        const text = typeof result === 'string' ? result : result.content
        const bytes =
          typeof result === 'string'
            ? new TextEncoder().encode(result).length
            : result.sizeBytes
        baselineRef.current = text
        setContentState(text)
        setSizeBytes(bytes)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || '无法读取文件')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      if (flushOnUnmount && dirtyRef.current) {
        void window.api.fs.writeText(filePath, contentRef.current)
      }
      // 关闭标签 / 退出应用：释放文本缓存
      contentRef.current = ''
      baselineRef.current = ''
      setContentState('')
      setSizeBytes(0)
    }
  }, [filePath, flushOnUnmount])

  const save = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    return persist(contentRef.current)
  }, [persist])

  const revert = useCallback((): void => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    setContentState(baselineRef.current)
    contentRef.current = baselineRef.current
    dirtyRef.current = false
    setDirty(false)
  }, [])

  const setContent = useCallback(
    (next: string): void => {
      setContentState(next)
      contentRef.current = next
      const isDirty = next !== baselineRef.current
      dirtyRef.current = isDirty
      setDirty(isDirty)

      if (!autoSave || !isDirty) return

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null
        void persist(next)
      }, AUTO_SAVE_DEBOUNCE_MS)
    },
    [autoSave, persist]
  )

  return {
    content,
    sizeBytes,
    isLargeFile: checkLargeFile(sizeBytes),
    loading,
    error,
    dirty,
    saving,
    setContent,
    save,
    revert
  }
}

/** @deprecated 使用 useLazyTextFile({ autoSave: true, flushOnUnmount: true }) */
export function useEditableFile(filePath: string) {
  const result = useLazyTextFile(filePath, { autoSave: true, flushOnUnmount: true })
  return {
    content: result.content,
    loading: result.loading,
    error: result.error,
    dirty: result.dirty,
    setContent: result.setContent
  }
}
