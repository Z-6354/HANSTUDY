import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clampWebZoom,
  WEB_ZOOM_DEFAULT,
  WEB_ZOOM_STEP,
  webZoomOrigin
} from '@shared/webZoom'

const STORAGE_KEY = 'hanstudy-web-zoom'

function loadWebZoom(origin: string): number {
  if (!origin) return WEB_ZOOM_DEFAULT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return WEB_ZOOM_DEFAULT
    const map = JSON.parse(raw) as Record<string, number>
    const value = map[origin]
    return value != null ? clampWebZoom(value) : WEB_ZOOM_DEFAULT
  } catch {
    return WEB_ZOOM_DEFAULT
  }
}

function saveWebZoom(origin: string, zoom: number): void {
  if (!origin) return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    map[origin] = clampWebZoom(zoom)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

export function useWebZoom(
  docId: string,
  url: string,
  isActive: boolean,
  guestReady: boolean
): {
  zoom: number
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
} {
  const origin = useMemo(() => webZoomOrigin(url), [url])
  const [zoom, setZoom] = useState(WEB_ZOOM_DEFAULT)
  const zoomRef = useRef(WEB_ZOOM_DEFAULT)

  const applyZoom = useCallback(
    (factor: number, persist: boolean): void => {
      const clamped = clampWebZoom(factor)
      void window.api.webGuest.setZoomFactor(clamped).then((actual) => {
        zoomRef.current = actual
        setZoom(actual)
        if (persist && origin) saveWebZoom(origin, actual)
      })
    },
    [origin]
  )

  useEffect(() => {
    if (!isActive || !guestReady || !origin) return
    applyZoom(loadWebZoom(origin), false)
  }, [applyZoom, guestReady, isActive, origin])

  useEffect(() => {
    return window.api.webGuest.onEvent((event) => {
      if (event.docId !== docId || event.type !== 'zoom-changed') return
      zoomRef.current = event.zoomFactor
      setZoom(event.zoomFactor)
      const eventOrigin = webZoomOrigin(event.url)
      if (eventOrigin) saveWebZoom(eventOrigin, event.zoomFactor)
    })
  }, [docId])

  const zoomIn = useCallback((): void => {
    applyZoom(zoomRef.current + WEB_ZOOM_STEP, true)
  }, [applyZoom])

  const zoomOut = useCallback((): void => {
    applyZoom(zoomRef.current - WEB_ZOOM_STEP, true)
  }, [applyZoom])

  const resetZoom = useCallback((): void => {
    applyZoom(WEB_ZOOM_DEFAULT, true)
  }, [applyZoom])

  return { zoom, zoomIn, zoomOut, resetZoom }
}
