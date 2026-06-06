import { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { IconButton } from '../../../components/IconButton'
import { useWorkspaceStore } from '../../../stores/workspaceStore'

export function DocumentFindBar(): JSX.Element | null {
  const {
    findBarOpen,
    findQuery,
    findMatchIndex,
    findMatchCount,
    setFindQuery,
    closeFindBar,
    stepFind
  } = useWorkspaceStore()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (findBarOpen) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [findBarOpen])

  if (!findBarOpen) return null

  const status =
    findQuery.trim().length === 0
      ? ''
      : findMatchCount === 0
        ? '无匹配'
        : `${findMatchIndex + 1} / ${findMatchCount}`

  return (
    <div className="document-find-bar" role="search">
      <input
        ref={inputRef}
        className="document-find-input"
        value={findQuery}
        onChange={(e) => setFindQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            stepFind(!e.shiftKey)
          }
          if (e.key === 'Escape') closeFindBar()
        }}
        placeholder="查找..."
        spellCheck={false}
        aria-label="查找文本"
      />
      <span className="document-find-status">{status}</span>
      <IconButton
        icon={ChevronUp}
        label="上一个"
        size={14}
        onClick={() => stepFind(false)}
      />
      <IconButton
        icon={ChevronDown}
        label="下一个"
        size={14}
        onClick={() => stepFind(true)}
      />
      <IconButton icon={X} label="关闭查找" size={14} onClick={closeFindBar} />
    </div>
  )
}
