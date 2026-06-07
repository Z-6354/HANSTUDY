import { useEffect } from 'react'

/** 检测 visualViewport 异常缩放并请求主进程复位（整窗 UI zoom 兜底） */
export function usePageZoomGuard(): void {
  useEffect(() => {
    const resetIfNeeded = (): void => {
      const vv = window.visualViewport
      if (!vv || Math.abs(vv.scale - 1) <= 0.01) return
      void window.api.window.resetPageZoom()
    }

    const vv = window.visualViewport
    vv?.addEventListener('resize', resetIfNeeded)
    vv?.addEventListener('scroll', resetIfNeeded)

    const interval = setInterval(resetIfNeeded, 120)

    return () => {
      vv?.removeEventListener('resize', resetIfNeeded)
      vv?.removeEventListener('scroll', resetIfNeeded)
      clearInterval(interval)
    }
  }, [])
}
