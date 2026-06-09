import { useEffect, useState } from 'react'
import { ChevronUp, Globe, Loader2, Lock, Search } from 'lucide-react'
import { searchEngineLabel } from '@shared/appSettings'
import { resolveWebInput } from '@shared/webCrop'
import { IconButton } from '../../components/IconButton'
import { useAppSettingsStore } from '../../stores/appSettingsStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'

export function GlobalSearchBar(): JSX.Element {
  const {
    documents,
    activeDocumentId,
    webSessions,
    openWebPage,
    dispatchWebNav,
    toggleLayoutPanel
  } = useWorkspaceStore()
  const searchEngine = useAppSettingsStore((s) => s.searchEngine)

  const activeDoc = documents.find((d) => d.id === activeDocumentId)
  const isWebTab = activeDoc?.type === 'web'
  const session =
    isWebTab && activeDoc ? webSessions[activeDoc.id] ?? null : null

  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (isWebTab && activeDoc && !focused) {
      setDraft(session?.currentUrl ?? activeDoc.path)
    }
  }, [activeDoc, isWebTab, session?.currentUrl, focused])

  const submit = (): void => {
    const normalized = resolveWebInput(draft, searchEngine)
    if (!normalized) return
    if (isWebTab && activeDoc) {
      dispatchWebNav('navigate', normalized)
    } else {
      openWebPage(draft)
    }
    setFocused(false)
  }

  const isSecure = draft.trim().startsWith('https://')
  const loading = session?.loading ?? false
  const engineName = searchEngineLabel(searchEngine)

  return (
    <div className="global-search-bar">
      <form
        className="global-search-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <span className="global-search-icon" aria-hidden>
          {loading ? (
            <Loader2 size={14} className="spinning" />
          ) : isSecure ? (
            <Lock size={12} />
          ) : (
            <Search size={14} />
          )}
        </span>
        <input
          className="global-search-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => {
            setFocused(true)
            if (e.currentTarget.value.length > 0) {
              e.currentTarget.select()
            }
          }}
          onBlur={() => setFocused(false)}
          placeholder={`搜索或输入网址（${engineName}）`}
          spellCheck={false}
          aria-label="搜索或网址"
        />
        <span className="global-search-engine-badge" title="在软件设置中可更换搜索引擎">
          <Globe size={11} />
          {engineName}
        </span>
        {session?.title && !focused && isWebTab && (
          <span className="global-search-title" title={session.title}>
            {session.title}
          </span>
        )}
      </form>
      <IconButton
        icon={ChevronUp}
        label="收起搜索与模式栏"
        size={14}
        className="global-search-collapse-btn"
        onClick={() => toggleLayoutPanel('globalSearchBar')}
      />
    </div>
  )
}
