import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Hash, MessageSquare, Flame, Play, ArrowRight } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { EmptyState } from '../components/EmptyState'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { api } from '../lib/api'
import type { Opportunity } from '../lib/types'

const FOCUS = [
  { id: 'structure', icon: Layers },
  { id: 'specifics', icon: Hash },
  { id: 'delivery', icon: MessageSquare },
  { id: 'pressure', icon: Flame },
]

export function MockScreen() {
  const t = useT()
  const navigate = useNavigate()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loaded, setLoaded] = useState(false)

  const [oppId, setOppId] = useState('')
  const [persona, setPersona] = useState('behavioral')
  const [mode, setMode] = useState('text')
  const [length, setLength] = useState('standard')
  const [focus, setFocus] = useState<string[]>(['structure'])

  useEffect(() => {
    api
      .get<{ items: Opportunity[] }>('/api/opportunities')
      .then((r) => setOpportunities(r.items ?? []))
      .catch(() => setOpportunities([]))
      .finally(() => setLoaded(true))
  }, [])

  const opp = useMemo(
    () => opportunities.find((o) => o.id === oppId) ?? opportunities[0],
    [opportunities, oppId],
  )

  const questionCount = opp?.questions?.length ?? 0
  const total = length === 'quick' ? Math.min(3, questionCount) : length === 'standard' ? Math.min(5, questionCount) : questionCount
  const estMin = Math.max(6, total * 3)

  const toggleFocus = (id: string) =>
    setFocus((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 2 ? [cur[1], id] : [...cur, id]))

  // 与线上一致：尚无岗位/预测题时展示空状态
  if (loaded && !opp) {
    return (
      <div className="page live-setup mock-warm">
        <div className="ls-wrap">
          <EmptyState
            artWebp="/art/empty-interview.webp"
            art="/art/empty-interview.png"
            title={t('mock_no_q')}
            action={
              <Button variant="secondary" onClick={() => navigate('/app/pipeline?add=1')}>
                {t('add_role')}
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="page live-setup mock-warm">
      <div className="ls-wrap">
        <div className="mw-flow rise-seq">
          <div className="ls-main">
            <section className="ls-block">
              <h2 className="mw-h">{t('mw_pick')}</h2>
              <Select
                value={opp?.id ?? ''}
                onChange={setOppId}
                ariaLabel={t('mw_pick')}
                options={opportunities.map((o) => ({
                  value: o.id,
                  label: `${o.role} · ${o.company}`,
                }))}
              />
            </section>

            <section className="ls-block">
              <h2 className="mw-h">{t('mw_tune')}</h2>
              <div className="mw-tune">
                <div>
                  <h2 className="mw-h">
                    {t('mw_focus_h')} <span className="mw-h-sub faint">{t('mw_focus_sub')}</span>
                  </h2>
                  <div className="mw-focus">
                    {FOCUS.map((c) => {
                      const Icon = c.icon
                      const on = focus.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          className={`mw-chip ${on ? 'is-on' : ''}`}
                          onClick={() => toggleFocus(c.id)}
                        >
                          <Icon size={15} /> {t(`focus_${c.id}`)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <h2 className="mw-h mw-h-quiet">{t('mw_how')}</h2>
                  <div className="mw-settings">
                    <div className="mw-set">
                      <span className="mw-set-l">{t('mock_persona')}</span>
                      <Select
                        size="sm"
                        value={persona}
                        onChange={setPersona}
                        options={[
                          { value: 'behavioral', label: t('persona_behavioral') },
                          { value: 'technical', label: t('persona_technical') },
                          { value: 'stress', label: t('persona_stress') },
                          { value: 'case', label: t('persona_case') },
                        ]}
                      />
                    </div>
                    <div className="mw-set">
                      <span className="mw-set-l">{t('mock_mode')}</span>
                      <Select
                        size="sm"
                        value={mode}
                        onChange={setMode}
                        options={[
                          { value: 'text', label: t('mode_text') },
                          { value: 'voice', label: t('mode_voice') },
                        ]}
                      />
                    </div>
                    <div className="mw-set">
                      <span className="mw-set-l">{t('mock_length')}</span>
                      <Select
                        size="sm"
                        value={length}
                        onChange={setLength}
                        options={[
                          { value: 'quick', label: t('len_quick') },
                          { value: 'standard', label: t('len_standard') },
                          { value: 'full', label: t('len_full') },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="mw-go">
          <div className="mw-go-meta">
            <span className="mw-go-len">{t('mw_sum_len', { n: total, min: estMin })}</span>
            <span className="mw-go-sub faint">{t('mw_report_promise')}</span>
          </div>
          <Button
            variant="primary"
            size="lg"
            icon={<Play size={17} />}
            onClick={() => navigate('/app/mock')}
          >
            {t('mw_start')}
          </Button>
        </div>
      </div>
    </div>
  )
}
