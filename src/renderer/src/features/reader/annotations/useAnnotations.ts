import { useCallback, useEffect, useState } from 'react'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import type { Annotation } from '../../../types/global.d'

export function useAnnotations(docPath: string, enabled = true): {
  annotations: Annotation[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  create: (input: Omit<Annotation, 'id' | 'createdAt' | 'docPath'>) => Promise<Annotation>
  update: (id: string, patch: Partial<Annotation>) => Promise<void>
  remove: (id: string) => Promise<void>
} {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const annotationTick = useWorkspaceStore((s) => s.annotationTick)

  const refresh = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!enabled || !docPath || docPath === '__none__') {
      setAnnotations([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const items = await window.api.annotations.list(docPath)
      if (signal?.cancelled) return
      setAnnotations(items)
    } catch (err) {
      if (signal?.cancelled) return
      setError(err instanceof Error ? err.message : '加载标注失败')
      setAnnotations([])
    } finally {
      if (!signal?.cancelled) setLoading(false)
    }
  }, [docPath, enabled])

  useEffect(() => {
    if (!enabled) {
      setAnnotations([])
      setLoading(false)
      return
    }
    const signal = { cancelled: false }
    void refresh(signal)
    return () => {
      signal.cancelled = true
    }
  }, [refresh, annotationTick, enabled])

  const create = useCallback(
    async (input: Omit<Annotation, 'id' | 'createdAt' | 'docPath'>) => {
      const item = await window.api.annotations.create({ ...input, docPath })
      setAnnotations((prev) => [...prev, item])
      useWorkspaceStore.getState().notifyAnnotationsChanged()
      return item
    },
    [docPath]
  )

  const update = useCallback(async (id: string, patch: Partial<Annotation>) => {
    const item = await window.api.annotations.update(id, patch)
    if (item) {
      setAnnotations((prev) => prev.map((a) => (a.id === id ? item : a)))
      useWorkspaceStore.getState().notifyAnnotationsChanged()
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    const ok = await window.api.annotations.delete(id)
    if (ok) {
      setAnnotations((prev) => prev.filter((a) => a.id !== id))
      useWorkspaceStore.getState().notifyAnnotationsChanged()
    } else {
      throw new Error('删除标注失败')
    }
  }, [])

  return { annotations, loading, error, refresh, create, update, remove }
}
