import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnnotationOverlay } from './AnnotationOverlay'

interface AnnotationSurfaceContextValue {
  registerSurface: (el: HTMLElement | null) => void
}

const AnnotationSurfaceContext = createContext<AnnotationSurfaceContextValue | null>(null)

export function useAnnotationSurface(surface: HTMLElement | null): void {
  const ctx = useContext(AnnotationSurfaceContext)
  useEffect(() => {
    if (!ctx) return
    ctx.registerSurface(surface)
    return () => ctx.registerSurface(null)
  }, [ctx, surface])
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

  const registerSurface = useCallback((el: HTMLElement | null) => {
    setSurface(el)
  }, [])

  const value = useMemo(() => ({ registerSurface }), [registerSurface])

  return (
    <AnnotationSurfaceContext.Provider value={value}>
      <div className="annotated-viewer-shell">
        {children}
        {surface &&
          createPortal(
            <AnnotationOverlay docPath={docPath} isActive={isActive} surface={surface} />,
            surface
          )}
      </div>
    </AnnotationSurfaceContext.Provider>
  )
}
