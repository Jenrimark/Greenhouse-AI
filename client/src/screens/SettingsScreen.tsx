import { useState } from 'react'
import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { useT, useI18n } from '../i18n/I18n'
import { useTheme, type ThemeMode } from '../lib/prefs'
import { useAppData } from '../shell/AppData'
import { Button } from '../components/Button'
import { api } from '../lib/api'

const THEMES: Array<{ id: ThemeMode; icon: any; key: string }> = [
  { id: 'light', icon: Sun, key: 'theme_light' },
  { id: 'dark', icon: Moon, key: 'theme_dark' },
  { id: 'system', icon: Monitor, key: 'theme_system' },
]

export function SettingsScreen() {
  const t = useT()
  const { lang, setLang } = useI18n()
  const theme = useTheme()
  const { me } = useAppData()
  const [name, setName] = useState(me?.name ?? '')
  const [saved, setSaved] = useState(false)

  const saveName = async () => {
    try {
      await api.patch('/api/me', { name })
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="page settings">
      <h1 className="page-head-t">{t('set_appearance')}</h1>
      <p className="page-head-sub">{t('set_appearance_desc')}</p>

      <section className="card set-sec">
        <div className="set-row">
          <div>
            <div className="set-l">{t('set_appearance')}</div>
          </div>
          <div className="seg">
            {THEMES.map((th) => {
              const Icon = th.icon
              return (
                <button
                  key={th.id}
                  className={theme.mode === th.id ? 'is-active' : ''}
                  onClick={() => theme.setMode(th.id)}
                >
                  <Icon size={14} /> {t(th.key)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="set-row">
          <div>
            <div className="set-l">{t('language_hint')}</div>
          </div>
          <div className="seg langtoggle">
            <button className={lang === 'zh' ? 'is-on' : ''} onClick={() => setLang('zh')}>
              中
            </button>
            <button className={lang === 'en' ? 'is-on' : ''} onClick={() => setLang('en')}>
              EN
            </button>
          </div>
        </div>
      </section>

      <section className="card set-sec">
        <div className="set-row set-row-col">
          <div className="set-l">{t('account_name')}</div>
          <div className="set-name-row">
            <div className="field" style={{ flex: 1 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('account_name_edit')} />
            </div>
            <Button variant="primary" icon={saved ? <Check size={15} /> : undefined} onClick={saveName}>
              {saved ? t('account_name_saved') : t('save')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
