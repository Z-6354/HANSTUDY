import {
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject,
  type RefObject
} from 'react'
import type { editor as MonacoEditor } from 'monaco-editor'
import type { WorkbenchMode } from '@shared/types'
import { layoutZoomProfile, type LayoutZoomProfile } from '@shared/layoutZoomProfile'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import {
  TXT_BASE_FONT_SIZE,
  TXT_ZOOM_SAVE_DEBOUNCE_MS,
  TXT_ZOOM_STEP,
  applyTxtWheelZoom,
  clampTxtZoom
} from './txtZoomPerf'

const ZOOM_STORAGE_KEY = 'hanstudy-txt-zoom'

function zoomStorageKey(filePath: string, slot: WorkbenchMode, layout: LayoutZoomProfile): string {
  return `${slot}:${layout}:${filePath}`
}

function loadZoom(filePath: string, slot: WorkbenchMode, layout: LayoutZoomProfile): number {
  try {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY)
    if (!raw) return 1
    const map = JSON.parse(raw) as Record<string, number>
    const key = zoomStorageKey(filePath, slot, layout)
    const legacyKey = `${slot}:${filePath}`
    const legacyFlat = map[filePath]
    return clampTxtZoom(
      map[key] ??
        (layout === 'L1R1' ? map[legacyKey] : undefined) ??
        (slot === 'browse' && layout === 'L1R1' ? legacyFlat : undefined) ??
        1
    )
  } catch {
    return 1
  }
}

function saveZoom(
  filePath: string,
  slot: WorkbenchMode,
  layout: LayoutZoomProfile,
  zoom: number
): void {
  try {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    map[zoomStorageKey(filePath, slot, layout)] = zoom
    localStorage.setItem(ZOOM_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

interface UseTxtZoomParams {
  filePath: string
  viewerSlot?: WorkbenchMode
  editMode: boolean
  editorRef: MutableRefObject<MonacoEditor.IStandaloneCodeEditor | null>
  readerRef: RefObject<HTMLElement | null>
  editorHostRef: RefObject<HTMLElement | null>
  isActive: boolean
  wheelHostRef: RefObject<HTMLElement | null>
}

export function useTxtZoom({
  filePath,
  viewerSlot = 'browse',
  editMode,
  editorRef,
  readerRef,
  editorHostRef,
  isActive,
  wheelHostRef
}: UseTxtZoomParams): {
  bindZoomLabelRef: (el: HTMLSpanElement | null) => void
  zoomIn: () => void
  zoomOut: () => void
  flushPendingZoom: () => void
  initialMonacoFontSize: number
} {
  const showSidebar = useWorkspaceStore((s) => s.showSidebar)
  const showAIPanel = useWorkspaceStore((s) => s.showAIPanel)
  const layoutProfile = layoutZoomProfile(showSidebar, showAIPanel)

  const zoomRef = useRef(loadZoom(filePath, viewerSlot, layoutProfile))
  const zoomLabelRef = useRef<HTMLSpanElement | null>(null)
  const wheelRafRef = useRef<number | null>(null)
  const wheelAccumRef = useRef({ deltaY: 0, deltaMode: 0 })
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filePathRef = useRef(filePath)
  filePathRef.current = filePath
  const viewerSlotRef = useRef(viewerSlot)
  viewerSlotRef.current = viewerSlot
  const layoutProfileRef = useRef(layoutProfile)
  layoutProfileRef.current = layoutProfile
  const editModeRef = useRef(editMode)
  editModeRef.current = editMode

  const updateZoomLabel = useCallback((zoom: number): void => {
    if (zoomLabelRef.current) {
      zoomLabelRef.current.textContent = `${Math.round(zoom * 100)}%`
    }
  }, [])

  const scheduleSave = useCallback((): void => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      saveZoom(
        filePathRef.current,
        viewerSlotRef.current,
        layoutProfileRef.current,
        zoomRef.current
      )
    }, TXT_ZOOM_SAVE_DEBOUNCE_MS)
  }, [])

  const commitMonacoFontSize = useCallback((zoom: number): void => {
    editorRef.current?.updateOptions({ fontSize: Math.round(TXT_BASE_FONT_SIZE * zoom) })
  }, [editorRef])

  const applyReaderZoom = useCallback(
    (zoom: number): void => {
      const el = readerRef.current
      if (!el) return
      el.style.removeProperty('zoom')
      el.style.setProperty('--txt-reader-zoom', String(zoom))
    },
    [readerRef]
  )

  const applyEditPreviewZoom = useCallback(
    (zoom: number): void => {
      editorHostRef.current?.style.removeProperty('zoom')
      commitMonacoFontSize(zoom)
    },
    [editorHostRef, commitMonacoFontSize]
  )

  const applyZoomVisual = useCallback(
    (zoom: number): void => {
      if (editModeRef.current) {
        applyEditPreviewZoom(zoom)
      } else {
        applyReaderZoom(zoom)
      }
      updateZoomLabel(zoom)
    },
    [applyEditPreviewZoom, applyReaderZoom, updateZoomLabel]
  )

  const applyZoomStep = useCallback(
    (next: number): void => {
      const clamped = clampTxtZoom(next)
      if (Math.abs(clamped - zoomRef.current) < 0.0001) return
      zoomRef.current = clamped
      applyZoomVisual(clamped)
      if (editModeRef.current) {
        commitMonacoFontSize(clamped)
      }
      scheduleSave()
    },
    [applyZoomVisual, commitMonacoFontSize, scheduleSave]
  )

  const zoomIn = useCallback(
    () => applyZoomStep(zoomRef.current + TXT_ZOOM_STEP),
    [applyZoomStep]
  )
  const zoomOut = useCallback(
    () => applyZoomStep(zoomRef.current - TXT_ZOOM_STEP),
    [applyZoomStep]
  )

  const bindZoomLabelRef = useCallback(
    (el: HTMLSpanElement | null): void => {
      zoomLabelRef.current = el
      if (el) updateZoomLabel(zoomRef.current)
    },
    [updateZoomLabel]
  )

  useEffect(() => {
    const prevLayout = layoutProfileRef.current
    if (prevLayout !== layoutProfile) {
      saveZoom(filePathRef.current, viewerSlotRef.current, prevLayout, zoomRef.current)
    }
    const zoom = loadZoom(filePath, viewerSlot, layoutProfile)
    zoomRef.current = zoom
    layoutProfileRef.current = layoutProfile
    updateZoomLabel(zoom)
    applyReaderZoom(zoom)
    if (editModeRef.current) {
      commitMonacoFontSize(zoom)
    }
  }, [filePath, viewerSlot, layoutProfile, applyReaderZoom, updateZoomLabel, commitMonacoFontSize])

  useEffect(() => {
    if (editMode) {
      editorHostRef.current?.style.removeProperty('zoom')
      editorRef.current?.updateOptions({
        fontSize: Math.round(TXT_BASE_FONT_SIZE * zoomRef.current)
      })
      return
    }
    applyReaderZoom(zoomRef.current)
  }, [editMode, applyReaderZoom, editorHostRef, editorRef])

  useEffect(() => {
    const host = wheelHostRef.current
    if (!host || !isActive) return

    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey) return
      e.preventDefault()
      e.stopPropagation()

      wheelAccumRef.current.deltaY += e.deltaY
      wheelAccumRef.current.deltaMode = e.deltaMode

      if (wheelRafRef.current != null) return
      wheelRafRef.current = requestAnimationFrame(() => {
        wheelRafRef.current = null
        const acc = wheelAccumRef.current
        wheelAccumRef.current = { deltaY: 0, deltaMode: 0 }

        const next = applyTxtWheelZoom(zoomRef.current, acc.deltaY, acc.deltaMode)
        if (Math.abs(next - zoomRef.current) < 0.0001) return

        zoomRef.current = next
        applyZoomVisual(next)
        scheduleSave()
      })
    }

    host.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      host.removeEventListener('wheel', onWheel)
      if (wheelRafRef.current != null) cancelAnimationFrame(wheelRafRef.current)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [isActive, wheelHostRef, applyZoomVisual, scheduleSave])

  const flushPendingZoom = useCallback((): void => {
    if (wheelRafRef.current != null) {
      cancelAnimationFrame(wheelRafRef.current)
      wheelRafRef.current = null
    }
    const acc = wheelAccumRef.current
    if (acc.deltaY === 0) return
    wheelAccumRef.current = { deltaY: 0, deltaMode: 0 }
    const next = applyTxtWheelZoom(zoomRef.current, acc.deltaY, acc.deltaMode)
    if (Math.abs(next - zoomRef.current) < 0.0001) return
    zoomRef.current = next
    applyZoomVisual(next)
    if (editModeRef.current) {
      commitMonacoFontSize(next)
    }
    scheduleSave()
  }, [applyZoomVisual, commitMonacoFontSize, scheduleSave])

  return {
    bindZoomLabelRef,
    zoomIn,
    zoomOut,
    flushPendingZoom,
    initialMonacoFontSize: Math.round(
      TXT_BASE_FONT_SIZE * loadZoom(filePath, viewerSlot, layoutProfile)
    )
  }
}
