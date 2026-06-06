import type { MutableRefObject } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import type { ReadingProgress } from '@shared/readingProgress'

const SAVE_DEBOUNCE_MS = 600

export function useReadingProgress(docPath: string, enabled = true): {
  saveProgress: (patch: Partial<ReadingProgress>) => void
  flushProgress: (patch: Partial<ReadingProgress>) => Promise<void>
  loadProgress: () => Promise<ReadingProgress | null>
  isRestoringRef: MutableRefObject<boolean>
} {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<Partial<ReadingProgress>>({})
  const isRestoringRef = useRef(false)

  const flushProgress = useCallback(
    async (patch: Partial<ReadingProgress> = {}): Promise<void> => {
      if (!enabled || !docPath || docPath === '__hanstudy_settings__') return
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      const merged = { ...pendingRef.current, ...patch }
      pendingRef.current = {}
      if (Object.keys(merged).length === 0) return
      await window.api.readingProgress.save({ docPath, ...merged })
    },
    [docPath, enabled]
  )

  const saveProgress = useCallback(
    (patch: Partial<ReadingProgress>): void => {
      if (!enabled || !docPath || isRestoringRef.current) return
      pendingRef.current = { ...pendingRef.current, ...patch }
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void flushProgress()
      }, SAVE_DEBOUNCE_MS)
    },
    [docPath, enabled, flushProgress]
  )

  const loadProgress = useCallback(async (): Promise<ReadingProgress | null> => {
    if (!enabled || !docPath) return null
    return window.api.readingProgress.get(docPath)
  }, [docPath, enabled])

  useEffect(() => {
    const pathAtMount = docPath
    return () => {
      const pending = pendingRef.current
      pendingRef.current = {}
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (!enabled || !pathAtMount || pathAtMount === '__hanstudy_settings__') return
      if (Object.keys(pending).length === 0) return
      void window.api.readingProgress.save({ docPath: pathAtMount, ...pending })
    }
  }, [docPath, enabled])

  return { saveProgress, flushProgress, loadProgress, isRestoringRef }
}
