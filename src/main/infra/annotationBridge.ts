import type { Annotation } from '../../shared/types'
import * as nodeStore from './annotationStore'
import {
  disableJavaBackend,
  isJavaBackendEnabled,
  javaDelete,
  javaGet,
  javaPatch,
  javaPost
} from '../runtime/javaBridge'

async function withJavaFallback<T>(
  op: string,
  javaFn: () => Promise<T>,
  nodeFn: () => Promise<T>
): Promise<T> {
  if (!isJavaBackendEnabled()) return nodeFn()
  try {
    return await javaFn()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[annotationBridge] ${op} via Java failed, falling back to Node:`, message)
    disableJavaBackend(message)
    return nodeFn()
  }
}

export async function listAnnotations(docPath: string): Promise<Annotation[]> {
  return withJavaFallback(
    'list',
    () => javaGet<Annotation[]>(`/api/annotations?docPath=${encodeURIComponent(docPath)}`),
    () => nodeStore.listAnnotations(docPath)
  )
}

export async function createAnnotation(
  input: Omit<Annotation, 'id' | 'createdAt'>
): Promise<Annotation> {
  return withJavaFallback(
    'create',
    () => javaPost<Annotation>('/api/annotations', input),
    () => nodeStore.createAnnotation(input)
  )
}

export async function updateAnnotation(
  id: string,
  patch: Partial<Pick<Annotation, 'content' | 'color' | 'type' | 'shape'>>
): Promise<Annotation | null> {
  return withJavaFallback(
    'update',
    () => javaPatch<Annotation>(`/api/annotations/${encodeURIComponent(id)}`, patch),
    () => nodeStore.updateAnnotation(id, patch)
  )
}

export async function deleteAnnotation(id: string): Promise<boolean> {
  return withJavaFallback(
    'delete',
    async () => {
      await javaDelete(`/api/annotations/${encodeURIComponent(id)}`)
      return true
    },
    () => nodeStore.deleteAnnotation(id)
  )
}

export async function exportAnnotationsMarkdown(docPath: string): Promise<string> {
  return withJavaFallback(
    'export',
    () => javaGet<string>(`/api/annotations/export?docPath=${encodeURIComponent(docPath)}`),
    () => nodeStore.exportAnnotationsMarkdown(docPath)
  )
}
