import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MonitorSpeaker, Globe, AppWindow, ShieldCheck, Monitor, ChevronRight, Play, Square, Mic, Eye, EyeOff, Volume2 } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { useAppData } from '../shell/AppData'

const SOURCES = [
  { id: 'speaker', icon: MonitorSpeaker, key: 'case_speaker', m: 'case_speaker_m', how: 'case_speaker_how' },
  { id: 'tab', icon: Globe, key: 'case_tab', m: 'case_tab_m', how: 'case_tab_how' },
  { id: 'system', icon: AppWindow, key: 'case_system', m: 'case_system_m', how: 'system_share_how' },
]

const ROUNDS = ['round_recruiter', 'R1', 'R2', 'round_panel']

const SHORTCUTS = [
  ['hk_assist', '⌘ ↵'],
  ['hk_hide', '⌘ ⇧ H'],
  ['hk_opacity', '⌘ ⇧ ↑↓'],
  ['hk_second', '⌘ ⇧ S'],
]

const MOCK_TRANSCRIPT = [
  { role: 'interviewer', text: '你好，请先做一个简短的自我介绍。' },
  { role: 'user', text: '你好，我是一名有5年经验的产品经理，专注于用户增长和产品策略...' },
  { role: 'interviewer', text: '能详细说说你主导的那个增长项目吗？' },
  { role: 'assistant', text: '提词建议：用STAR结构回答，重点说明你做了什么决策、取得了什么量化成果。建议提及：用户留存提升23%、DAU增长15万。' },
]

export function LiveScreen() {
  const t = useT()
  const navigate = useNavigate()
  const { credits } = useAppData()
  const [source, setSource] = useState('speaker')
  const [round, setRound] = useState('R2')
  const [isListening, setIsListening] = useState(false)
  const [showPrompter, setShowPrompter] = useState(true)
  const [prompterOpacity, setPrompterOpacity] = useState(90)
  const [transcript, setTranscript] = useState(MOCK_TRANSCRIPT)
  const [transcriptStep, setTranscriptStep] = useState(MOCK_TRANSCRIPT.length)

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false)
    } else {
      setIsListening(true)
      // Mock: 模拟实时转写和提词
      let step = transcriptStep
      const interval = setInterval(() => {
        if (step >= MOCK_TRANSCRIPT.length) {
          clearInterval(interval)
          return
        }
        setTranscript((prev) => [...prev, MOCK_TRANSCRIPT[step]])
        step++
        setTranscriptStep(step)
      }, 3000)
    }
  }

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

          {/* 实时转写区域 */}
          {isListening && (
            <section className="ls-block ls-transcript">
              <div className="ls-transcript-h">
                <span className="ls-transcript-title">
                  <span className="ls-live-dot" /> 实时转写中
                </span>
                <Button variant="ghost" size="sm" onClick={() => setTranscript([])}>清空</Button>
              </div>
              <div className="ls-transcript-body">
                {transcript.map((item, i) => (
                  <div key={i} className={`ls-transcript-item ${item.role}`}>
                    <span className="ls-transcript-role">
                      {item.role === 'interviewer' ? '面试官' : item.role === 'user' ? '你' : 'AI 提词'}
                    </span>
                    <span className="ls-transcript-text">{item.text}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <Button
            variant={isListening ? 'danger' : 'primary'}
            size="lg"
            icon={isListening ? <Square size={16} /> : <Play size={16} />}
            onClick={toggleListening}
          >
            {isListening ? '停止监听' : t('live_rehearse_go')}
          </Button>
        </div>

        <aside className="ls-side">
          <div className="card ls-second">
            <div className="ls-second-h">
              <ShieldCheck size={16} /> {t('lo_private_h')}
            </div>
            <p className="faint ls-second-body">{t('lo_private_body')}</p>
            <div className="ls-second-art">
              <img src="/art/art-second-device.webp" alt="" aria-hidden="true" />
            </div>
            <button className="ls-second-btn" type="button" onClick={() => alert('请用手机扫描二维码，在第二块屏幕显示提词')}>
              <Monitor size={16} className="ls-second-btn-ico" />
              <span className="ls-second-btn-copy">
                <span className="ls-second-btn-t">{t('use_phone')}</span>
                <span className="ls-second-btn-s faint">{t('scan_second')}</span>
              </span>
              <ChevronRight size={14} className="ls-second-btn-arrow" />
            </button>
          </div>

          {/* 提词控制 */}
          <div className="card ls-prompter-control">
            <div className="ls-prompter-h">
              <span>提词显示</span>
              <button className="iconbtn" onClick={() => setShowPrompter(!showPrompter)}>
                {showPrompter ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
            <div className="ls-prompter-body">
              <div className="ls-prompter-row">
                <span className="faint">不透明度</span>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={prompterOpacity}
                  onChange={(e) => setPrompterOpacity(Number(e.target.value))}
                  disabled={!showPrompter}
                />
                <span className="ls-prompter-val">{prompterOpacity}%</span>
              </div>
              <div className="ls-prompter-row">
                <span className="faint">字体大小</span>
                <Select value="medium" onChange={() => {}} options={[
                  { value: 'small', label: '小' },
                  { value: 'medium', label: '中' },
                  { value: 'large', label: '大' },
                ]} />
              </div>
              <div className="ls-prompter-row">
                <span className="faint">位置</span>
                <Select value="bottom" onChange={() => {}} options={[
                  { value: 'top', label: '顶部' },
                  { value: 'bottom', label: '底部' },
                  { value: 'floating', label: '悬浮' },
                ]} />
              </div>
            </div>
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
          <span className={`ls-status-dot ${isListening ? 'is-active' : ''}`} />
          {isListening ? '正在监听…' : t('live_not_ready')}
        </span>
        <span className="grow" />
        <span className="faint">
          {t('live_low_credits', { n: credits || 300, est: 450 })}
        </span>
        <Button variant={isListening ? 'danger' : 'primary'} disabled={false} onClick={toggleListening}>
          {isListening ? '停止' : t('start_listening')}
        </Button>
      </div>
    </div>
  )
}
