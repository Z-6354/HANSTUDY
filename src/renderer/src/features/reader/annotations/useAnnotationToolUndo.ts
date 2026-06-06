import { useCallback, useEffect, type RefObject } from 'react'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import type { Annotation, AnnotationTool } from '../../../types/global.d'
import {
  findLastAnnotationByType,
  toolUsesRightClickUndo
} from './annotationToolUtils'
import { findLastTextMarkupAnnotation, refreshTextMarkup } from './textUtils'

async function undoDomToolAction(
  tool: AnnotationTool,
  annotations: Annotation[],
  remove: (id: string) => Promise<void>,
  markupRoot: HTMLElement | null
): Promise<boolean> {
  if (tool === 'highlight' || tool === 'underline') {
    const last = findLastTextMarkupAnnotation(annotations, tool)
    if (!last) return false
    await remove(last.id)
    if (markupRoot) {
      refreshTextMarkup(
        markupRoot,
        annotations.filter((a) => a.id !== last.id)
      )
    }
    window.getSelection()?.removeAllRanges()
    return true
  }
  if (tool === 'note') {
    const last = findLastAnnotationByType(annotations, 'note')
    if (!last) return false
    await remove(last.id)
    window.getSelection()?.removeAllRanges()
    return true
  }
  return false
}

/** DOM 文档：高亮 / 下划线 / 便签 — 右键撤销最近一条同类型标注 */
export function useDomAnnotationToolUndo(
  annotations: Annotation[],
  remove: (id: string) => Promise<void>,
  containerRef: RefObject<HTMLElement | null>,
  enabled = true
): void {
  const annotationTool = useWorkspaceStore((s) => s.annotationTool)

  const undo = useCallback(async (): Promise<void> => {
    const tool = useWorkspaceStore.getState().annotationTool
    if (!toolUsesRightClickUndo(tool)) return
    if (tool === 'pen' || tool === 'rect' || tool === 'eraser') return
    await undoDomToolAction(tool, annotations, remove, containerRef.current)
  }, [annotations, remove, containerRef])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !enabled) return

    const onContextMenu = (e: MouseEvent): void => {
      const tool = useWorkspaceStore.getState().annotationTool
      if (!toolUsesRightClickUndo(tool)) return
      if (tool === 'pen' || tool === 'rect' || tool === 'eraser') return
      e.preventDefault()
      void undo()
    }

    el.addEventListener('contextmenu', onContextMenu)
    return () => el.removeEventListener('contextmenu', onContextMenu)
  }, [enabled, containerRef, undo, annotationTool])
}

/** Monaco 编辑器：高亮 / 下划线 / 便签 — 右键撤销（装饰由 annotations effect 刷新） */
export function useMonacoAnnotationToolUndo(
  annotations: Annotation[],
  remove: (id: string) => Promise<void>,
  getEditorDom: () => HTMLElement | null,
  enabled = true
): void {
  const annotationTool = useWorkspaceStore((s) => s.annotationTool)

  const undo = useCallback(async (): Promise<void> => {
    const tool = useWorkspaceStore.getState().annotationTool
    if (!toolUsesRightClickUndo(tool)) return
    if (tool === 'pen' || tool === 'rect' || tool === 'eraser') return
    await undoDomToolAction(tool, annotations, remove, null)
  }, [annotations, remove])

  useEffect(() => {
    if (!enabled) return
    const el = getEditorDom()
    if (!el) return

    const onContextMenu = (e: MouseEvent): void => {
      const tool = useWorkspaceStore.getState().annotationTool
      if (!toolUsesRightClickUndo(tool)) return
      if (tool === 'pen' || tool === 'rect' || tool === 'eraser') return
      e.preventDefault()
      void undo()
    }

    el.addEventListener('contextmenu', onContextMenu)
    return () => el.removeEventListener('contextmenu', onContextMenu)
  }, [enabled, getEditorDom, undo, annotationTool])
}
