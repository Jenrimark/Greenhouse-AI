import { NavLink, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  MessageCircle,
  LayoutGrid,
  Telescope,
  Compass,
  PenLine,
  BarChart3,
  MessagesSquare,
  AudioLines,
  PanelLeftClose,
  PanelLeftOpen,
  CircleHelp,
  ChevronDown,
} from 'lucide-react'
import { useState } from 'react'
import { useT } from '../i18n/I18n'
import { useAppData } from './AppData'

interface NavEntry {
  to: string
  key: string
  icon: LucideIcon
  end?: boolean
}

// 主导航顺序
const NAV: NavEntry[] = [
  { to: '/app', key: 'nav_command', icon: MessageCircle, end: true },
  { to: '/app/pipeline', key: 'nav_pipeline', icon: LayoutGrid },
  { to: '/app/discover', key: 'nav_discover', icon: Telescope },
  { to: '/app/atlas', key: 'nav_atlas', icon: Compass },
  { to: '/app/studio', key: 'nav_studio', icon: PenLine },
  { to: '/app/stories', key: 'nav_story', icon: BarChart3 },
  { to: '/app/mock', key: 'nav_mock', icon: MessagesSquare },
  { to: '/app/live', key: 'nav_live', icon: AudioLines },
]

const WORDMARK = '/assets/wordmark-BxDO-Y1g.png'

export function AppRail() {
  const t = useT()
  const navigate = useNavigate()
  const { me, dueCount } = useAppData()
  const [open, setOpen] = useState(true)

  const isActive = (entry: NavEntry, pathname: string) =>
    entry.end ? pathname === entry.to : pathname.startsWith(entry.to)

  return (
    <aside className={`rail ${open ? 'is-open' : 'is-compact'}`}>
      <div className="rail-top">
        {open ? (
          <>
            <NavLink to="/app" className="rail-brand" aria-label="Greenroom home">
              <span className="rail-slot">
                <img src="/icon.svg" width={26} height={26} alt="Greenroom" />
              </span>
              <span className="rail-fade">
                <span
                  className="wordmark"
                  role="img"
                  aria-label="Greenroom"
                  style={{ WebkitMaskImage: `url(${WORDMARK})`, maskImage: `url(${WORDMARK})` }}
                />
              </span>
            </NavLink>
            <button className="rail-toggle" aria-label={t('rail_collapse')} onClick={() => setOpen(false)}>
              <PanelLeftClose size={16} />
            </button>
          </>
        ) : (
          <button
            className="rail-brand rail-brand-btn"
            aria-label={t('rail_expand')}
            onClick={() => setOpen(true)}
          >
            <span className="rail-slot">
              <img src="/icon.svg" width={26} height={26} alt="Greenroom" />
            </span>
          </button>
        )}
      </div>

      <nav className="rail-nav" aria-label={t('nav_primary')}>
        {NAV.map((entry) => {
          const Icon = entry.icon
          return (
            <NavLink
              key={entry.key}
              to={entry.to}
              end={entry.end}
              data-nav-key={entry.key}
              className={({ isActive: a }) =>
                `nav-item ${a || (typeof window !== 'undefined' && isActive(entry, window.location.pathname)) ? 'is-active' : ''}`
              }
              aria-label={t(entry.key)}
            >
              <span className="nav-ico">
                <Icon size={18} />
              </span>
              <span className="nav-label rail-fade">{t(entry.key)}</span>
              {entry.key === 'nav_pipeline' && dueCount > 0 && (
                <span className="nav-count rail-fade">{dueCount}</span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="rail-foot">
        <button className="rail-help" aria-label={t('help_open')} onClick={() => alert('帮助中心：\n\n• 助手：与 AI 对话，获取求职建议\n• 机会管线：管理投递进度\n• 找岗位：搜索和筛选岗位\n• 岗位地图：查看岗位上下游关系\n• 简历工作室：创建和优化简历\n• 经历库：管理项目经历\n• 模拟面试：AI 面试练习\n• 实时助手：面试实时提词\n\n快捷键：⌘K 搜索 / ⌘J AI 助手')}>
          <span className="rail-slot">
            <CircleHelp size={18} />
          </span>
          <span className="grow rail-fade truncate">{t('help_open')}</span>
        </button>

        <button className="rail-profile" onClick={() => navigate('/app/settings')}>
          <span className="rail-slot">
            {me?.avatarUrl ? (
              <img className="rail-avatar" src={me.avatarUrl} alt="" width={26} height={26} />
            ) : (
              <span className="rail-avatar-fallback">{me?.name?.slice(0, 1) ?? '我'}</span>
            )}
          </span>
          <span className="rail-fade rail-profile-n truncate">
            {me ? `${me.name}（${me.handle}）` : '…'}
          </span>
          <ChevronDown size={14} className="rail-fade" />
        </button>
      </div>
    </aside>
  )
}
