import { useCallback, useEffect, useState } from 'react'

/** Monaco `height="100%"` often resolves to 0 inside flex layouts — measure the container instead. */
export function useMonacoHeight(): {
  containerRef: (node: HTMLDivElement | null) => void
  height: number
} {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(0)

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    setNode(el)
  }, [])

  useEffect(() => {
    if (!node) {
      setHeight(0)
      return
    }

    const update = (): void => {
      const next = Math.floor(node.getBoundingClientRect().height)
      setHeight((prev) => (prev === next ? prev : next))
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => ro.disconnect()
  }, [node])

  return { containerRef, height }
}
