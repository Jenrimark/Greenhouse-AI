import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Search,
  MessageCircle,
  LayoutGrid,
  Telescope,
  Compass,
  PenLine,
  BarChart3,
  MessagesSquare,
  AudioLines,
  CornerDownLeft,
} from 'lucide-react'
import { useT } from '../i18n/I18n'

interface CmdItem {
  to: string
  key: string
  icon: LucideIcon
  hint: string
}

const ITEMS: CmdItem[] = [
  { to: '/app', key: 'nav_command', icon: MessageCircle, hint: 'Assistant' },
  { to: '/app/pipeline', key: 'nav_pipeline', icon: LayoutGrid, hint: 'Pipeline' },
  { to: '/app/discover', key: 'nav_discover', icon: Telescope, hint: 'Discover' },
  { to: '/app/atlas', key: 'nav_atlas', icon: Compass, hint: 'Atlas' },
  { to: '/app/studio', key: 'nav_studio', icon: PenLine, hint: 'Studio' },
  { to: '/app/stories', key: 'nav_story', icon: BarChart3, hint: 'Stories' },
  { to: '/app/mock', key: 'nav_mock', icon: MessagesSquare, hint: 'Mock' },
  { to: '/app/live', key: 'nav_live', icon: AudioLines, hint: 'Live' },
]

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // 全局 ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!open) {
          setQ('')
          setActive(0)
        }
      }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (!kw) return ITEMS
    return ITEMS.filter((i) => {
      const label = t(i.key).toLowerCase()
      return label.includes(kw) || i.hint.toLowerCase().includes(kw) || i.to.includes(kw)
    })
  }, [q, t])

  if (!open) return null

  const go = (item: CmdItem) => {
    navigate(item.to)
    onClose()
  }

  return (
    <div
      className="cmd-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="cmd" role="dialog" aria-modal="true" aria-label={t('search_cmd')}>
        <div className="cmd-search">
          <Search size={19} />
          <input
            ref={inputRef}
            className="cmd-input"
            value={q}
            placeholder={t('search_cmd')}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(filtered.length - 1, a + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(0, a - 1))
              } else if (e.key === 'Enter' && filtered[active]) {
                go(filtered[active])
              }
            }}
          />
        </div>
        <div className="cmd-list">
          <div className="cmd-group">
            <div className="cmd-group-h">{t('nav_primary')}</div>
            {filtered.length === 0 && <div className="cmd-empty">{t('cmd_no_result')}</div>}
            {filtered.map((item, i) => {
              const Icon = item.icon
              return (
                <button
                  key={item.to}
                  className={`cmd-item ${i === active ? 'is-active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(item)}
                >
                  <span className="cmd-item-ico">
                    <Icon size={16} />
                  </span>
                  <span className="cmd-item-label">{t(item.key)}</span>
                  <span className="cmd-item-sub grow" />
                  <span className="cmd-item-hint">{item.hint}</span>
                  <CornerDownLeft size={13} className="cmd-item-arrow" />
                </button>
              )
            })}
          </div>
        </div>
        <div className="cmd-foot">
          <span>↑↓ {t('cmd_navigate')}</span>
          <span>↵ {t('cmd_open')}</span>
          <span>esc {t('close')}</span>
        </div>
      </div>
    </div>
  )
}
