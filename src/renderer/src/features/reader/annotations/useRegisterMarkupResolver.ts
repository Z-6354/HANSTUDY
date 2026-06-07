import { useContext, useEffect } from 'react'
import { AnnotationSurfaceContext } from './AnnotationSurfaceContext'
import type { MarkupRectResolver } from './markupOverlayUtils'

/** 注册高亮/下划线矩形解析器，供 AnnotationOverlay 覆盖层绘制 */
export function useRegisterMarkupResolver(
  resolver: MarkupRectResolver | null,
  enabled = true
): void {
  const ctx = useContext(AnnotationSurfaceContext)
  useEffect(() => {
    if (!ctx) return
    if (!enabled || !resolver) {
      ctx.registerMarkupResolver(null)
      return
    }
    ctx.registerMarkupResolver(resolver)
    return () => ctx.registerMarkupResolver(null)
  }, [ctx, resolver, enabled])
}
