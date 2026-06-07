import { useEffect, useState } from 'react'
import type { TextOutlineItem } from './textOutline'

export function useDeferredOutline(
  content: string,
  parse: (text: string) => TextOutlineItem[],
  enabled: boolean,
  defer: boolean
): TextOutlineItem[] {
  const [items, setItems] = useState<TextOutlineItem[]>([])

  useEffect(() => {
    if (!enabled || !content) {
      setItems([])
      return
    }

    if (!defer) {
      setItems(parse(content))
      return
    }

    let cancelled = false
    const run = (): void => {
      if (cancelled) return
      setItems(parse(content))
    }

    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run, { timeout: 1500 })
      return () => {
        cancelled = true
        cancelIdleCallback(id)
      }
    }

    const timer = setTimeout(run, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [content, enabled, defer, parse])

  return items
}
