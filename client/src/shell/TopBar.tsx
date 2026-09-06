import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Sparkles, SquarePen, ChevronDown, Plus, MessageSquare, Trash2 } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { CommandPalette } from '../components/CommandPalette'
import { useState, useRef, useEffect } from 'react'

// 路由 -> 面包屑标题 i18n key
const TITLE_KEY: Array<[RegExp, string]> = [
  [/^\/app\/?$/, 'nav_command'],
  [/^\/app\/pipeline/, 'nav_pipeline'],
  [/^\/app\/opportunity/, 'nav_pipeline'],
  [/^\/app\/discover/, 'nav_discover'],
  [/^\/app\/atlas/, 'nav_atlas'],
  [/^\/app\/studio/, 'nav_studio'],
  [/^\/app\/stories/, 'nav_story'],
  [/^\/app\/mock/, 'nav_mock'],
  [/^\/app\/live/, 'nav_live'],
  [/^\/app\/settings/, 'settings_title'],
]

function titleKeyFor(pathname: string) {
  return TITLE_KEY.find(([re]) => re.test(pathname))?.[1] ?? 'nav_command'
}

// Mock 历史对话
const MOCK_THREADS = [
  { id: '1', title: '优化 AI 产品经理简历', time: '今天 10:30' },
  { id: '2', title: '字节跳动前端工程师面试准备', time: '昨天 15:20' },
  { id: '3', title: '分析岗位匹配度', time: '3 天前' },
]

export function TopBar() {
  const t = useT()
  const location = useLocation()
  const navigate = useNavigate()
  const [cmdOpen, setCmdOpen] = useState(false)
  const [threadOpen, setThreadOpen] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const isAssistant = location.pathname === '/app' || location.pathname === '/app/'
  const title = t(titleKeyFor(location.pathname))

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (threadRef.current && !threadRef.current.contains(e.target as Node)) {
        setThreadOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const newThread = () => {
    setThreadOpen(false)
    // 重新导航到 /app 会重新挂载 AssistantScreen，清空消息
    navigate('/app')
    window.dispatchEvent(new CustomEvent('gr:new-thread'))
  }

  return (
    <>
      <header className="topbar">
        <nav className="topbar-crumb" aria-label={t('breadcrumb_label')}>
          <ol>
            <li>
              <span className="crumb crumb-current" aria-current="page">
                {title}
              </span>
            </li>
          </ol>
        </nav>

        {isAssistant && (
          <div className="topbar-thread-wrap" ref={threadRef}>
            <button
              className="threadswitch"
              type="button"
              onClick={() => setThreadOpen(!threadOpen)}
              aria-expanded={threadOpen}
            >
              {t('ai_new_thread')}
              <ChevronDown size={14} className={threadOpen ? 'is-open' : ''} />
            </button>

            {threadOpen && (
              <div className="thread-menu">
                <button className="thread-menu-item thread-new" onClick={newThread}>
                  <Plus size={14} />
                  <span>新对话</span>
                </button>
                <div className="thread-menu-divider" />
                <div className="thread-menu-h">最近对话</div>
                {MOCK_THREADS.map((th) => (
                  <button
                    key={th.id}
                    className="thread-menu-item"
                    onClick={() => {
                      setThreadOpen(false)
                      newThread()
                    }}
                  >
                    <MessageSquare size={14} className="thread-menu-icon" />
                    <span className="thread-menu-title">{th.title}</span>
                    <span className="thread-menu-time">{th.time}</span>
                  </button>
                ))}
                <div className="thread-menu-divider" />
                <button className="thread-menu-item thread-danger" onClick={() => alert('已清空所有历史对话（mock）')}>
                  <Trash2 size={14} />
                  <span>清空历史</span>
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grow" />

        {isAssistant && (
          <button
            className="iconbtn topbar-new"
            aria-label={t('ai_new_thread')}
            title={t('ai_new_thread')}
            onClick={newThread}
          >
            <SquarePen size={17} />
          </button>
        )}

        <button className="cmdk" onClick={() => setCmdOpen(true)}>
          <Search size={14} />
          <span className="cmdk-t">{t('search_cmd')}</span>
          <kbd className="kbd">⌘K</kbd>
        </button>

        {!isAssistant && (
          <button
            className="iconbtn"
            aria-label={t('ai_panel')}
            title={`${t('ai_panel')} (⌘J)`}
            onClick={() => navigate('/app')}
          >
            <Sparkles size={17} />
          </button>
        )}
      </header>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  )
}
