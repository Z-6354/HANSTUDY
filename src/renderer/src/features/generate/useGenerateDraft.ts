import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'hanstudy-generate-drafts'
const SAVE_DEBOUNCE_MS = 400

export interface GenerateDraft {
  title: string
  body: string
  updatedAt: string
}

const GENERATE_DRAFT_KEY = '__generate__'

function draftKey(): string {
  return GENERATE_DRAFT_KEY
}

function loadDraft(key: string): GenerateDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyDraft()
    const map = JSON.parse(raw) as Record<string, GenerateDraft>
    const item = map[key]
    if (!item) return emptyDraft()
    return {
      title: item.title ?? '',
      body: item.body ?? '',
      updatedAt: item.updatedAt ?? ''
    }
  } catch {
    return emptyDraft()
  }
}

function emptyDraft(): GenerateDraft {
  return { title: '', body: '', updatedAt: '' }
}

function persistDraft(key: string, draft: GenerateDraft): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, GenerateDraft>) : {}
    map[key] = draft
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

export function useGenerateDraft(): {
  title: string
  body: string
  setTitle: (value: string) => void
  setBody: (value: string) => void
  clearDraft: () => void
  savedHint: boolean
} {
  const key = draftKey()
  const [title, setTitleState] = useState(() => loadDraft(key).title)
  const [body, setBodyState] = useState(() => loadDraft(key).body)
  const [savedHint, setSavedHint] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keyRef = useRef(key)
  const titleRef = useRef(title)
  const bodyRef = useRef(body)
  keyRef.current = key
  titleRef.current = title
  bodyRef.current = body

  const scheduleSave = useCallback((): void => {
    setSavedHint(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      const draft: GenerateDraft = {
        title: titleRef.current,
        body: bodyRef.current,
        updatedAt: new Date().toISOString()
      }
      persistDraft(keyRef.current, draft)
      setSavedHint(true)
    }, SAVE_DEBOUNCE_MS)
  }, [])

  useEffect(() => {
    const loaded = loadDraft(key)
    setTitleState(loaded.title)
    setBodyState(loaded.body)
    titleRef.current = loaded.title
    bodyRef.current = loaded.body
    setSavedHint(true)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const setTitle = useCallback((value: string): void => {
    setTitleState(value)
    titleRef.current = value
    scheduleSave()
  }, [scheduleSave])

  const setBody = useCallback((value: string): void => {
    setBodyState(value)
    bodyRef.current = value
    scheduleSave()
  }, [scheduleSave])

  const clearDraft = useCallback((): void => {
    setTitleState('')
    setBodyState('')
    titleRef.current = ''
    bodyRef.current = ''
    persistDraft(keyRef.current, emptyDraft())
    setSavedHint(true)
  }, [])

  return { title, body, setTitle, setBody, clearDraft, savedHint }
}

export function buildGenerateNoteMarkdown(title: string, body: string): string {
  const trimmedTitle = title.trim()
  const trimmedBody = body.trim()
  if (!trimmedTitle && !trimmedBody) return ''
  if (!trimmedTitle) return trimmedBody
  if (!trimmedBody) return `# ${trimmedTitle}`
  return `# ${trimmedTitle}\n\n${trimmedBody}`
}
