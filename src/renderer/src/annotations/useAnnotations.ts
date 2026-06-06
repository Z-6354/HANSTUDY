import { useCallback, useEffect, useState } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { Annotation } from '../types/global.d'

export function useAnnotations(docPath: string): {
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

  const refresh = useCallback(async () => {
    if (!docPath || docPath === '__none__') {
      setAnnotations([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const items = await window.api.annotations.list(docPath)
      setAnnotations(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载标注失败')
      setAnnotations([])
    } finally {
      setLoading(false)
    }
  }, [docPath])

  useEffect(() => {
    refresh()
  }, [refresh, annotationTick])

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
