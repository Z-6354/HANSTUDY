import { useCallback, useEffect, useState } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { Annotation } from '../types/global.d'

export function useAnnotations(docPath: string): {
  annotations: Annotation[]
  loading: boolean
  refresh: () => Promise<void>
  create: (input: Omit<Annotation, 'id' | 'createdAt' | 'docPath'>) => Promise<Annotation>
  update: (id: string, patch: Partial<Annotation>) => Promise<void>
  remove: (id: string) => Promise<void>
} {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [loading, setLoading] = useState(true)
  const annotationTick = useWorkspaceStore((s) => s.annotationTick)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const items = await window.api.annotations.list(docPath)
      setAnnotations(items)
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
    await window.api.annotations.delete(id)
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
  }, [])

  return { annotations, loading, refresh, create, update, remove }
}
