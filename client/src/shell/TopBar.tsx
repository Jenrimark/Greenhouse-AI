import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Sparkles, SquarePen, ChevronDown } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { CommandPalette } from '../components/CommandPalette'
import { useState } from 'react'

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

export function TopBar() {
  const t = useT()
  const location = useLocation()
  const navigate = useNavigate()
  const [cmdOpen, setCmdOpen] = useState(false)
  const isAssistant = location.pathname === '/app' || location.pathname === '/app/'
  const title = t(titleKeyFor(location.pathname))

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
          <button className="threadswitch" type="button">
            {t('ai_new_thread')}
            <ChevronDown size={14} />
          </button>
        )}

        <div className="grow" />

        {isAssistant && (
          <button className="iconbtn topbar-new" aria-label={t('ai_new_thread')}>
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
