import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createPortal } from 'react-dom'
import { AnnotationOverlay } from './AnnotationOverlay'
import type { MarkupRectResolver } from './markupOverlayUtils'

interface AnnotationSurfaceContextValue {
  registerSurface: (el: HTMLElement | null) => void
  registerMarkupResolver: (fn: MarkupRectResolver | null) => void
  getMarkupResolver: () => MarkupRectResolver | null
  markupLayoutKey: number
  refreshPortal: () => void
}

export const AnnotationSurfaceContext = createContext<AnnotationSurfaceContextValue | null>(null)

export function useAnnotationSurface(surface: HTMLElement | null): void {
  const ctx = useContext(AnnotationSurfaceContext)
  useEffect(() => {
    if (!ctx) return
    ctx.registerSurface(surface)
    return () => ctx.registerSurface(null)
  }, [ctx, surface])
}

/** PDF 等视图在 imperative DOM 更新后强制 remount 绘图层 */
export function useAnnotationPortalRefresh(): () => void {
  const ctx = useContext(AnnotationSurfaceContext)
  return ctx?.refreshPortal ?? (() => {})
}

interface AnnotatedViewerShellProps {
  docPath: string
  isActive: boolean
  children: ReactNode
}

export function AnnotatedViewerShell({
  docPath,
  isActive,
  children
}: AnnotatedViewerShellProps): JSX.Element {
  const [surface, setSurface] = useState<HTMLElement | null>(null)
  const [portalKey, setPortalKey] = useState(0)
  const [markupLayoutKey, setMarkupLayoutKey] = useState(0)
  const markupResolverRef = useRef<MarkupRectResolver | null>(null)

  const registerSurface = useCallback((el: HTMLElement | null) => {
    flushSync(() => setSurface(el))
  }, [])

  const registerMarkupResolver = useCallback((fn: MarkupRectResolver | null) => {
    markupResolverRef.current = fn
    setMarkupLayoutKey((key) => key + 1)
  }, [])

  const getMarkupResolver = useCallback(() => markupResolverRef.current, [])

  const refreshPortal = useCallback(() => {
    setPortalKey((key) => key + 1)
    setMarkupLayoutKey((key) => key + 1)
  }, [])

  const value = useMemo(
    () => ({
      registerSurface,
      registerMarkupResolver,
      getMarkupResolver,
      markupLayoutKey,
      refreshPortal
    }),
    [registerSurface, registerMarkupResolver, getMarkupResolver, markupLayoutKey, refreshPortal]
  )

  return (
    <AnnotationSurfaceContext.Provider value={value}>
      <div className="annotated-viewer-shell">
        {children}
        {surface &&
          createPortal(
            <AnnotationOverlay
              key={portalKey}
              docPath={docPath}
              isActive={isActive}
              surface={surface}
              getMarkupResolver={getMarkupResolver}
              markupLayoutKey={markupLayoutKey}
            />,
            surface
          )}
      </div>
    </AnnotationSurfaceContext.Provider>
  )
}
