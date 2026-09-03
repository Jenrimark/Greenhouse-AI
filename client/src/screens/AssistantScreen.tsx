import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowUp, PenLine, Target, ListChecks } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { useAppData } from '../shell/AppData'

function greetingKey(hour: number, named: boolean) {
  const part = hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return named ? `greeting_${part}` : `greeting_${part}_anon`
}

function todayZh() {
  const d = new Date()
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 周${'日一二三四五六'[d.getDay()]}`
}

export function AssistantScreen() {
  const t = useT()
  const navigate = useNavigate()
  const { me } = useAppData()
  const [value, setValue] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)

  const hour = new Date().getHours()
  const firstName = me?.name?.trim().split(' ')[0] || ''
  const greeting = t(greetingKey(hour, !!firstName), { name: firstName })

  const suggestions = useMemo(
    () => [
      { key: 'home_sug_resume', icon: PenLine, to: '/app/studio', primary: true },
      { key: 'home_sug_jd', icon: Target, to: '/app/discover' },
      { key: 'home_sug_look', icon: ListChecks, to: '/app/pipeline' },
    ],
    [],
  )

  const autoSize = () => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  const ready = value.trim().length > 0

  return (
    <div className="home">
      <div className="home-wrap home-center">
        <div className="hw">
          <h1 className="hw-h">{greeting}</h1>
          <p className="hw-sub">
            <span>{todayZh()}</span>
          </p>
        </div>

        <div className="home-composer">
          <div className="home-composer-top">
            <textarea
              ref={taRef}
              className="hc-input"
              rows={1}
              placeholder={t('home_composer_ph')}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                autoSize()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  if (ready) navigate('/app')
                }
              }}
            />
          </div>
          <div className="home-composer-bar">
            <button className="hc-plus" type="button" aria-label={t('hc_attach')} title={t('hc_attach')}>
              <Plus size={18} />
            </button>
            <span className="grow" />
            <button
              className={`hc-run ${ready ? 'is-ready' : ''}`}
              type="button"
              disabled={!ready}
              aria-label={t('ask_greenroom')}
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>

        <ul className="hw-sugs is-track" aria-label={t('ai_suggestions')}>
          {suggestions.map((s) => {
            const Icon = s.icon
            return (
              <li className="hw-sug-item" key={s.key}>
                <button
                  type="button"
                  className={`hw-sug ${s.primary ? 'is-primary' : ''}`}
                  onClick={() => navigate(s.to)}
                >
                  <span className="hw-sug-ico" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <span className="hw-sug-copy">
                    <span className="hw-sug-title truncate">{t(s.key)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
