import { useEffect } from 'react'

/** visualViewport 异常或 Ctrl+滚轮后异步复位整页 zoom（无轮询、无 sendSync） */
export function usePageZoomGuard(): void {
  useEffect(() => {
    let pending = false

    const resetIfNeeded = (): void => {
      const vv = window.visualViewport
      if (!vv || Math.abs(vv.scale - 1) <= 0.01 || pending) return
      pending = true
      void window.api.window.resetPageZoom().finally(() => {
        pending = false
      })
    }

    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      requestAnimationFrame(resetIfNeeded)
    }

    const vv = window.visualViewport
    vv?.addEventListener('resize', resetIfNeeded)
    vv?.addEventListener('scroll', resetIfNeeded)
    window.addEventListener('wheel', onWheel, { passive: true, capture: true })

    return () => {
      vv?.removeEventListener('resize', resetIfNeeded)
      vv?.removeEventListener('scroll', resetIfNeeded)
      window.removeEventListener('wheel', onWheel, { capture: true })
    }
  }, [])
}
