import { useCallback, useContext } from 'react'
import { AnnotationSurfaceContext } from './AnnotationSurfaceContext'

/** ref 回调同步注册标注表面，避免 useState + useEffect 错过挂载时机 */
export function useBindAnnotationSurface(): (el: HTMLElement | null) => void {
  const ctx = useContext(AnnotationSurfaceContext)
  return useCallback(
    (el: HTMLElement | null) => {
      ctx?.registerSurface(el)
    },
    [ctx]
  )
}
