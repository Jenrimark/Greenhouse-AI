import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MonitorSpeaker, Globe, AppWindow, MonitorSmartphone, Play } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { Button } from '../components/Button'
import { useAppData } from '../shell/AppData'

const SOURCES = [
  { id: 'speaker', icon: MonitorSpeaker, key: 'case_speaker', m: 'case_speaker_m', how: 'case_speaker_how' },
  { id: 'tab', icon: Globe, key: 'case_tab', m: 'case_tab_m', how: 'case_tab_how' },
  { id: 'system', icon: AppWindow, key: 'case_system', m: 'case_system_m', how: 'system_share_how' },
]

const ROUNDS = ['round_recruiter', 'R1', 'R2', 'round_panel']

const SHORTCUTS = [
  ['hk_assist', '⌥ Space'],
  ['hk_hide', '⌥ H'],
  ['hk_opacity', '⌥ [ / ]'],
  ['hk_second', '⌥ 2'],
]

export function LiveScreen() {
  const t = useT()
  const navigate = useNavigate()
  const { credits } = useAppData()
  const [source, setSource] = useState('speaker')
  const [round, setRound] = useState('R2')

  return (
    <div className="page live-setup">
      <div className="ls-wrap ls-two-col">
        <div className="ls-main">
          <section className="ls-block">
            <h2 className="ls-h">{t('which_interview')}</h2>
            <p className="faint ls-note">{t('ls_no_opp')}</p>
          </section>

          <section className="ls-block">
            <h2 className="ls-h">{t('how_hear_h')}</h2>
            <div className="ls-sources">
              {SOURCES.map((s) => {
                const Icon = s.icon
                const on = source === s.id
                return (
                  <button
                    key={s.id}
                    className={`ls-source ${on ? 'is-on' : ''}`}
                    onClick={() => setSource(s.id)}
                  >
                    <span className="ls-source-top">
                      <span className="ls-radio" aria-hidden="true">
                        <span className="ls-radio-dot" />
                      </span>
                      <Icon size={17} />
                      <span className="ls-source-name">{t(s.key)}</span>
                    </span>
                    <span className="ls-source-m faint">{t(s.m)}</span>
                    <span className="ls-source-how faint">{t(s.how)}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="ls-block">
            <h2 className="ls-h">{t('round_style')}</h2>
            <div className="seg">
              {ROUNDS.map((r) => (
                <button key={r} className={round === r ? 'is-active' : ''} onClick={() => setRound(r)}>
                  {r.startsWith('round') ? t(r) : r}
                </button>
              ))}
            </div>
          </section>

          <Button variant="primary" size="lg" icon={<Play size={16} />} onClick={() => navigate('/app/mock')}>
            {t('live_rehearse_go')}
          </Button>
        </div>

        <aside className="ls-side">
          <div className="card ls-second">
            <div className="ls-second-art">
              <img src="/art/art-second-device.webp" alt="" aria-hidden="true" />
            </div>
            <div className="ls-second-h">
              <MonitorSmartphone size={16} /> {t('lo_private_h')}
            </div>
            <p className="faint">{t('lo_private_body')}</p>
            <Button variant="secondary" full>
              {t('use_phone')}
            </Button>
            <p className="ls-scan-note faint">{t('scan_second')}</p>
          </div>

          <div className="card ls-hotkeys">
            <div className="ls-hotkeys-h">{t('hotkeys')}</div>
            {SHORTCUTS.map(([k, sc]) => (
              <div className="menu-keyrow" key={k}>
                <span className="grow">{t(k)}</span>
                <span className="menu-caps">
                  {sc.split(' ').map((x, i) => (
                    <kbd className="kbd" key={i}>
                      {x}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="ls-statusbar">
        <span className="ls-status-state">
          <span className="ls-status-dot" /> {t('live_not_ready')}
        </span>
        <span className="grow" />
        <span className="faint">
          {t('live_low_credits', { n: credits || 300, est: 20 })}
        </span>
        <Button variant="primary" disabled>
          {t('start_listening')}
        </Button>
      </div>
    </div>
  )
}
