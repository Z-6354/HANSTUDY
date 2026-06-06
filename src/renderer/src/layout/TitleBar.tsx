import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, Minus, Settings, Sparkles, Square, X } from 'lucide-react'
import { IconButton } from '../components/IconButton'
import { useWorkspaceStore } from '../stores/workspaceStore'
import type { LayoutPanelId } from '../stores/workspaceStore'
import { AppIcon } from './AppIcon'
import { PromptModal } from './PromptModal'

interface MenuItem {
  label: string
  shortcut?: string
  checked?: boolean
  action?: () => void
  submenu?: MenuItem[]
}

interface MenuGroup {
  label: string
  items: MenuItem[]
}

const LAYOUT_PANELS: { id: LayoutPanelId; label: string; shortcut?: string }[] = [
  { id: 'sidebar', label: '资源管理器', shortcut: 'Ctrl+B' },
  { id: 'tabBar', label: '标签栏' },
  { id: 'annotationToolbar', label: '标注工具栏' },
  { id: 'aiPanel', label: 'AI 助手', shortcut: 'Ctrl+Shift+A' }
]

export function TitleBar(): JSX.Element {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [hoverSubmenu, setHoverSubmenu] = useState<string | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [webPromptOpen, setWebPromptOpen] = useState(false)
  const [webPromptError, setWebPromptError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const {
    toggleAIPanel,
    showAIPanel,
    openSettings,
    showSidebar,
    showTabBar,
    showAnnotationToolbar,
    toggleLayoutPanel,
    setSidebarTab
  } = useWorkspaceStore()

  const openFile = async (): Promise<void> => {
    const result = await window.api.dialog.openFile()
    if (result) {
      useWorkspaceStore.getState().openDocument(result)
    }
    setActiveMenu(null)
  }

  const openFolder = async (): Promise<void> => {
    const result = await window.api.dialog.openFolder()
    if (result) {
      useWorkspaceStore.getState().setRootFolder(result.path, result.files)
    }
    setActiveMenu(null)
  }

  const openWebPage = (): void => {
    setWebPromptError('')
    setWebPromptOpen(true)
    setActiveMenu(null)
  }

  const submitWebUrl = (value: string): void => {
    const ok = useWorkspaceStore.getState().openWebPage(value)
    if (!ok) {
      setWebPromptError('请输入网址或搜索关键词')
      return
    }
    setWebPromptOpen(false)
    setWebPromptError('')
  }

  const isPanelVisible = (id: LayoutPanelId): boolean => {
    switch (id) {
      case 'sidebar':
        return showSidebar
      case 'tabBar':
        return showTabBar
      case 'annotationToolbar':
        return showAnnotationToolbar
      case 'aiPanel':
        return showAIPanel
      default:
        return false
    }
  }

  const layoutSubmenu: MenuItem[] = LAYOUT_PANELS.map((panel) => ({
    label: panel.label,
    shortcut: panel.shortcut,
    checked: isPanelVisible(panel.id),
    action: () => toggleLayoutPanel(panel.id)
  }))

  const menus: MenuGroup[] = [
    {
      label: '文件',
      items: [
        { label: '打开文件...', shortcut: 'Ctrl+O', action: openFile },
        { label: '打开文件夹...', shortcut: 'Ctrl+K Ctrl+O', action: openFolder },
        { label: '打开网页...', shortcut: 'Ctrl+Shift+U', action: openWebPage },
        { label: '退出', shortcut: 'Alt+F4', action: () => window.api.window.close() }
      ]
    },
    {
      label: '编辑',
      items: [
        { label: '查找', shortcut: 'Ctrl+F', action: () => setActiveMenu(null) },
        { label: '全选', shortcut: 'Ctrl+A', action: () => setActiveMenu(null) }
      ]
    },
    {
      label: '查看',
      items: [{ label: '布局', submenu: layoutSubmenu }]
    },
    {
      label: '帮助',
      items: [{ label: '关于 HAN Study Reader', action: () => setActiveMenu(null) }]
    }
  ]

  useEffect(() => {
    window.api.window.isMaximized().then(setIsMaximized)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
        setHoverSubmenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key === 'o' && !e.shiftKey) {
        e.preventDefault()
        void openFile()
      }
      if (e.ctrlKey && e.key === 'b' && !e.shiftKey) {
        e.preventDefault()
        toggleLayoutPanel('sidebar')
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        toggleAIPanel()
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault()
        if (!showSidebar) toggleLayoutPanel('sidebar')
        setSidebarTab('notes')
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'U') {
        e.preventDefault()
        openWebPage()
      }
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        openSettings('system')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleAIPanel, openSettings, toggleLayoutPanel, setSidebarTab, showSidebar])

  const renderMenuItem = (item: MenuItem, parentKey: string): JSX.Element => {
    const itemKey = `${parentKey}-${item.label}`
    const hasSubmenu = Boolean(item.submenu?.length)

    if (hasSubmenu) {
      return (
        <div
          key={itemKey}
          className="menu-dropdown-item-wrapper"
          onMouseEnter={() => setHoverSubmenu(itemKey)}
          onMouseLeave={() => setHoverSubmenu((prev) => (prev === itemKey ? null : prev))}
        >
          <button type="button" className="menu-dropdown-item has-submenu">
            <span>{item.label}</span>
            <ChevronRight size={12} className="submenu-arrow" aria-hidden />
          </button>
          {hoverSubmenu === itemKey && (
            <div className="menu-submenu">
              {item.submenu!.map((sub) => renderMenuItem(sub, itemKey))}
            </div>
          )}
        </div>
      )
    }

    return (
      <button
        key={itemKey}
        type="button"
        className={`menu-dropdown-item${item.checked ? ' checked' : ''}`}
        onClick={() => {
          item.action?.()
          if (item.checked === undefined) setActiveMenu(null)
        }}
      >
        <span className="menu-check">{item.checked ? <Check size={12} /> : null}</span>
        <span className="menu-label">{item.label}</span>
        {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
      </button>
    )
  }

  return (
    <div className="titlebar">
      <div className="titlebar-left">
        <div className="titlebar-app-icon" title="HAN Study Reader">
          <AppIcon />
        </div>
        <div className="titlebar-menu" ref={menuRef}>
          {menus.map((menu) => (
            <div key={menu.label} className="menu-item-wrapper">
              <button
                type="button"
                className={`menu-item ${activeMenu === menu.label ? 'active' : ''}`}
                onClick={() => {
                  setActiveMenu(activeMenu === menu.label ? null : menu.label)
                  setHoverSubmenu(null)
                }}
              >
                {menu.label}
              </button>
              {activeMenu === menu.label && (
                <div className="menu-dropdown">
                  {menu.items.map((item) => renderMenuItem(item, menu.label))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="titlebar-drag">HAN Study Reader</div>

      <div className="titlebar-right">
        <IconButton
          icon={Sparkles}
          label={showAIPanel ? '隐藏 AI 面板 (Ctrl+Shift+A)' : '显示 AI 面板 (Ctrl+Shift+A)'}
          className="titlebar-action-btn"
          active={showAIPanel}
          onClick={toggleAIPanel}
        />
        <IconButton
          icon={Settings}
          label="软件设置 (Ctrl+,)"
          className="titlebar-action-btn"
          onClick={() => openSettings('system')}
        />
        <div className="window-controls">
          <button
            type="button"
            className="window-control"
            onClick={() => window.api.window.minimize()}
            title="最小化"
            aria-label="最小化"
          >
            <Minus size={12} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className="window-control"
            onClick={async () => {
              await window.api.window.maximize()
              setIsMaximized(await window.api.window.isMaximized())
            }}
            title={isMaximized ? '还原' : '最大化'}
            aria-label={isMaximized ? '还原' : '最大化'}
          >
            <Square size={10} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className="window-control close"
            onClick={() => window.api.window.close()}
            title="关闭"
            aria-label="关闭"
          >
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      {webPromptOpen && (
        <PromptModal
          title="打开网页"
          label="网址"
          placeholder="https://example.com"
          error={webPromptError || undefined}
          onSubmit={submitWebUrl}
          onCancel={() => {
            setWebPromptOpen(false)
            setWebPromptError('')
          }}
        />
      )}
    </div>
  )
}
