import { useEffect, useState } from 'react'
import {
  Clock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Smartphone,
  Star,
  Trash2
} from 'lucide-react'
import { formatPhoneDisplay, isRecordableWebUrl, webDisplayTitle, webPageOrigin } from '../../../shared/webLibrary'
import { IconButton } from '../components/IconButton'
import { useWebLibraryStore } from '../stores/webLibraryStore'
import { useWorkspaceStore } from '../stores/workspaceStore'

type WebPanelSection = 'history' | 'bookmarks' | 'credentials' | 'phones'

function formatVisitTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function WebPanel(): JSX.Element {
  const [section, setSection] = useState<WebPanelSection>('history')
  const {
    documents,
    activeDocumentId,
    openWebPage,
    webSession
  } = useWorkspaceStore()
  const {
    loaded,
    load,
    history,
    bookmarks,
    credentials,
    phones,
    removeHistory,
    clearHistory,
    addBookmark,
    removeBookmark,
    saveCredential,
    removeCredential,
    removePhone,
    getCredentialPassword
  } = useWebLibraryStore()

  const activeDoc = documents.find((d) => d.id === activeDocumentId)
  const isWebTab = activeDoc?.type === 'web'
  const session =
    isWebTab && activeDoc && webSession?.docId === activeDoc.id ? webSession : null
  const currentUrl = session?.currentUrl ?? (isWebTab ? activeDoc?.path : '')
  const currentTitle = session?.title ?? ''

  const [credOrigin, setCredOrigin] = useState('')
  const [credUsername, setCredUsername] = useState('')
  const [credPassword, setCredPassword] = useState('')
  const [credLabel, setCredLabel] = useState('')
  const [editingCredId, setEditingCredId] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const [revealedPassword, setRevealedPassword] = useState('')

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  useEffect(() => {
    if (isWebTab && currentUrl) {
      setCredOrigin(webPageOrigin(currentUrl) || currentUrl)
    }
  }, [isWebTab, currentUrl])

  const openUrl = (url: string): void => {
    openWebPage(url)
  }

  const handleBookmarkCurrent = async (): Promise<void> => {
    if (!isRecordableWebUrl(currentUrl)) return
    await addBookmark(currentUrl, currentTitle || currentUrl)
    setActionMsg('已加入收藏')
    window.setTimeout(() => setActionMsg(null), 2000)
  }

  const resetCredForm = (): void => {
    setEditingCredId(null)
    setCredUsername('')
    setCredPassword('')
    setCredLabel('')
    setShowPassword(false)
    if (isWebTab && currentUrl) {
      setCredOrigin(webPageOrigin(currentUrl) || currentUrl)
    }
  }

  const handleSaveCredential = async (): Promise<void> => {
    if (!credOrigin.trim() || !credUsername.trim()) {
      setActionMsg('请填写站点与用户名')
      return
    }
    await saveCredential({
      id: editingCredId ?? undefined,
      origin: credOrigin.trim(),
      username: credUsername.trim(),
      password: credPassword,
      label: credLabel.trim() || undefined
    })
    resetCredForm()
    setActionMsg('账号已保存（密码本地加密）')
    window.setTimeout(() => setActionMsg(null), 2000)
  }

  const startEditCredential = async (id: string): Promise<void> => {
    const item = credentials.find((c) => c.id === id)
    if (!item) return
    setEditingCredId(id)
    setCredOrigin(item.origin)
    setCredUsername(item.username)
    setCredLabel(item.label ?? '')
    setCredPassword(await getCredentialPassword(id))
    setSection('credentials')
  }

  const revealPassword = async (id: string): Promise<void> => {
    if (revealedId === id) {
      setRevealedId(null)
      setRevealedPassword('')
      return
    }
    const pwd = await getCredentialPassword(id)
    setRevealedId(id)
    setRevealedPassword(pwd)
  }

  const copyPassword = async (id: string): Promise<void> => {
    const pwd = await getCredentialPassword(id)
    if (!pwd) return
    await navigator.clipboard.writeText(pwd)
    setActionMsg('密码已复制')
    window.setTimeout(() => setActionMsg(null), 1500)
  }

  return (
    <div className="web-panel">
      <div className="web-panel-tabs">
        <button
          type="button"
          className={`web-panel-tab ${section === 'history' ? 'active' : ''}`}
          onClick={() => setSection('history')}
        >
          <Clock size={13} aria-hidden />
          历史
        </button>
        <button
          type="button"
          className={`web-panel-tab ${section === 'bookmarks' ? 'active' : ''}`}
          onClick={() => setSection('bookmarks')}
        >
          <Star size={13} aria-hidden />
          收藏
        </button>
        <button
          type="button"
          className={`web-panel-tab ${section === 'credentials' ? 'active' : ''}`}
          onClick={() => setSection('credentials')}
        >
          <KeyRound size={13} aria-hidden />
          账号
        </button>
        <button
          type="button"
          className={`web-panel-tab ${section === 'phones' ? 'active' : ''}`}
          onClick={() => setSection('phones')}
        >
          <Smartphone size={13} aria-hidden />
          手机
        </button>
      </div>

      {actionMsg && <p className="web-panel-msg">{actionMsg}</p>}

      {section === 'history' && (
        <div className="web-panel-section">
          <div className="web-panel-toolbar">
            <span className="web-panel-count">{history.length} 条记录</span>
            {history.length > 0 && (
              <button type="button" className="web-panel-link-btn" onClick={() => void clearHistory()}>
                清空
              </button>
            )}
          </div>
          <div className="web-panel-list">
            {history.length === 0 ? (
              <p className="web-panel-empty">浏览网页后会自动记录历史</p>
            ) : (
              history.map((item) => (
                <div key={item.id} className="web-panel-item">
                  <button
                    type="button"
                    className="web-panel-item-main"
                    onClick={() => openUrl(item.url)}
                  >
                    <span className="web-panel-item-title">
                      {webDisplayTitle(item.title, item.url)}
                    </span>
                    <span className="web-panel-item-meta">{formatVisitTime(item.visitedAt)}</span>
                    <span className="web-panel-item-url">{item.url}</span>
                  </button>
                  <IconButton
                    icon={Trash2}
                    label="删除"
                    size={14}
                    className="web-panel-item-delete"
                    onClick={() => void removeHistory(item.id)}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {section === 'bookmarks' && (
        <div className="web-panel-section">
          <div className="web-panel-toolbar">
            {isWebTab && isRecordableWebUrl(currentUrl) ? (
              <button type="button" className="web-panel-action-btn" onClick={() => void handleBookmarkCurrent()}>
                <Star size={13} aria-hidden />
                收藏当前页
              </button>
            ) : (
              <span className="web-panel-hint">打开网页标签后可收藏当前页</span>
            )}
          </div>
          <div className="web-panel-list">
            {bookmarks.length === 0 ? (
              <p className="web-panel-empty">暂无收藏</p>
            ) : (
              bookmarks.map((item) => (
                <div key={item.id} className="web-panel-item">
                  <button
                    type="button"
                    className="web-panel-item-main"
                    onClick={() => openUrl(item.url)}
                  >
                    <span className="web-panel-item-title">
                      {webDisplayTitle(item.title, item.url)}
                    </span>
                    <span className="web-panel-item-url">{item.url}</span>
                  </button>
                  <IconButton
                    icon={Trash2}
                    label="取消收藏"
                    size={14}
                    className="web-panel-item-delete"
                    onClick={() => void removeBookmark(item.id)}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {section === 'credentials' && (
        <div className="web-panel-section web-panel-credentials">
          <p className="web-panel-hint web-panel-credentials-note">
            登录态（Cookie）由浏览器分区自动保存；此处可手动保存站点账号密码，密码经系统加密后存于本地。
          </p>
          <div className="web-cred-form">
            <label>
              站点
              <input
                value={credOrigin}
                onChange={(e) => setCredOrigin(e.target.value)}
                placeholder="https://example.com"
                spellCheck={false}
              />
            </label>
            <label>
              用户名
              <input
                value={credUsername}
                onChange={(e) => setCredUsername(e.target.value)}
                placeholder="邮箱或用户名"
                autoComplete="off"
              />
            </label>
            <label>
              密码
              <div className="web-cred-password-row">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={credPassword}
                  onChange={(e) => setCredPassword(e.target.value)}
                  placeholder={editingCredId ? '留空则保留原密码' : '密码'}
                  autoComplete="off"
                />
                <IconButton
                  icon={showPassword ? EyeOff : Eye}
                  label={showPassword ? '隐藏密码' : '显示密码'}
                  size={14}
                  onClick={() => setShowPassword((v) => !v)}
                />
              </div>
            </label>
            <label>
              备注（可选）
              <input
                value={credLabel}
                onChange={(e) => setCredLabel(e.target.value)}
                placeholder="例如：工作账号"
              />
            </label>
            <div className="web-cred-form-actions">
              <button type="button" className="web-panel-action-btn primary" onClick={() => void handleSaveCredential()}>
                <Plus size={13} aria-hidden />
                {editingCredId ? '更新账号' : '保存账号'}
              </button>
              {editingCredId && (
                <button type="button" className="web-panel-link-btn" onClick={resetCredForm}>
                  取消编辑
                </button>
              )}
            </div>
          </div>
          <div className="web-panel-list">
            {credentials.length === 0 ? (
              <p className="web-panel-empty">暂无保存的账号</p>
            ) : (
              credentials.map((item) => (
                <div key={item.id} className="web-panel-item web-cred-item">
                  <button
                    type="button"
                    className="web-panel-item-main"
                    onClick={() => void startEditCredential(item.id)}
                  >
                    <span className="web-panel-item-title">
                      {item.label || item.username}
                    </span>
                    <span className="web-panel-item-meta">{item.username}</span>
                    <span className="web-panel-item-url">{item.origin}</span>
                    {revealedId === item.id && revealedPassword && (
                      <span className="web-cred-revealed">{revealedPassword}</span>
                    )}
                  </button>
                  <div className="web-cred-item-actions">
                    <IconButton
                      icon={Eye}
                      label="查看密码"
                      size={14}
                      active={revealedId === item.id}
                      onClick={() => void revealPassword(item.id)}
                    />
                    <IconButton
                      icon={Copy}
                      label="复制密码"
                      size={14}
                      onClick={() => void copyPassword(item.id)}
                    />
                    <IconButton
                      icon={Trash2}
                      label="删除"
                      size={14}
                      onClick={() => void removeCredential(item.id)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {section === 'phones' && (
        <div className="web-panel-section">
          <p className="web-panel-hint web-panel-credentials-note">
            在网页表单中输入手机号后会自动保存；再次聚焦手机号输入框时可快速选择填充。
          </p>
          <div className="web-panel-toolbar">
            <span className="web-panel-count">{phones.length} 个号码</span>
          </div>
          <div className="web-panel-list">
            {phones.length === 0 ? (
              <p className="web-panel-empty">暂无保存的手机号</p>
            ) : (
              phones.map((item) => (
                <div key={item.id} className="web-panel-item">
                  <div className="web-panel-item-main web-panel-item-static">
                    <span className="web-panel-item-title">{formatPhoneDisplay(item.phone)}</span>
                    {item.origin && (
                      <span className="web-panel-item-url">{item.origin}</span>
                    )}
                    <span className="web-panel-item-meta">{formatVisitTime(item.updatedAt)}</span>
                  </div>
                  <IconButton
                    icon={Trash2}
                    label="删除"
                    size={14}
                    className="web-panel-item-delete"
                    onClick={() => void removePhone(item.id)}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
