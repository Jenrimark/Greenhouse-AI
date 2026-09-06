import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sun, Moon, Monitor, Check, X,
  User, Briefcase, CreditCard, Palette, MessageSquare,
  Shield, Keyboard, Info, RefreshCw, LogOut, Trash2,
} from 'lucide-react'
import { useT, useI18n } from '../i18n/I18n'
import { useTheme, type ThemeMode } from '../lib/prefs'
import { useAppData } from '../shell/AppData'
import { Button } from '../components/Button'
import { PixelAvatar } from '../components/PixelAvatar'
import { api } from '../lib/api'

type SectionId = 'account' | 'profile' | 'subscription' | 'appearance' | 'assistant' | 'privacy' | 'shortcuts' | 'about'

const NAV_SECTIONS = [
  {
    label: '账号与服务',
    items: [
      { id: 'account' as SectionId, icon: User, key: 'set_account' },
      { id: 'profile' as SectionId, icon: Briefcase, key: 'set_profile' },
      { id: 'subscription' as SectionId, icon: CreditCard, key: 'set_subscription' },
    ],
  },
  {
    label: '使用偏好',
    items: [
      { id: 'appearance' as SectionId, icon: Palette, key: 'set_appearance' },
      { id: 'assistant' as SectionId, icon: MessageSquare, key: 'set_assistant_style' },
    ],
  },
  {
    label: '隐私与支持',
    items: [
      { id: 'privacy' as SectionId, icon: Shield, key: 'set_privacy' },
      { id: 'shortcuts' as SectionId, icon: Keyboard, key: 'set_shortcuts' },
      { id: 'about' as SectionId, icon: Info, key: 'set_about' },
    ],
  },
]

const THEMES: Array<{ id: ThemeMode; icon: any; key: string }> = [
  { id: 'light', icon: Sun, key: 'theme_light' },
  { id: 'dark', icon: Moon, key: 'theme_dark' },
  { id: 'system', icon: Monitor, key: 'theme_system' },
]

export function SettingsScreen() {
  const t = useT()
  const navigate = useNavigate()
  const { lang, setLang } = useI18n()
  const theme = useTheme()
  const { me, credits } = useAppData()
  const [section, setSection] = useState<SectionId>('account')
  const [name, setName] = useState(me?.name ?? '')
  const [saved, setSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState('08:08:32')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const close = () => navigate('/app')

  const saveName = async () => {
    try {
      await api.patch('/api/me', { name })
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch {
      /* ignore */
    }
  }

  const handleSync = () => {
    setSyncing(true)
    setTimeout(() => {
      const now = new Date()
      setLastSync(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`)
      setSyncing(false)
    }, 1500)
  }

  const handleSignOut = () => {
    if (confirm('确定要退出登录吗？')) {
      navigate('/login')
    }
  }

  const handleDeleteData = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    alert('云端数据已删除（mock）')
    setShowDeleteConfirm(false)
  }

  const handleUpgrade = () => {
    alert('升级功能即将上线，敬请期待！')
  }

  const handleSetupAuthenticator = () => {
    alert('请使用认证器 App 扫描二维码完成两步验证设置（mock）')
  }

  const sectionTitle = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.id === section)?.key ?? 'set_account'

  return (
    <div className="modal-scrim settings-scrim" onClick={close}>
      <div className="modal-card settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* 左侧导航 */}
        <nav className="settings-nav">
          <div className="settings-nav-title">{t('settings')}</div>
          {NAV_SECTIONS.map((sec) => (
            <div key={sec.label} className="settings-nav-group">
              <div className="settings-nav-group-label">{sec.label}</div>
              {sec.items.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    className={`settings-nav-item ${section === item.id ? 'is-active' : ''}`}
                    onClick={() => setSection(item.id)}
                  >
                    <Icon size={16} />
                    <span>{t(item.key)}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* 右侧内容 */}
        <div className="settings-content">
          <div className="settings-content-head">
            <h2 className="settings-content-title">{t(sectionTitle)}</h2>
            <button className="iconbtn settings-close" onClick={close} aria-label={t('close')}>
              <X size={18} />
            </button>
          </div>
          <div className="settings-content-body">
            {section === 'account' && (
              <>
                {/* 用户资料卡 */}
                <div className="settings-profile-card">
                  <PixelAvatar seed={me?.name ?? 'user'} size={48} />
                  <div className="settings-profile-info">
                    <div className="settings-profile-name">{me?.name ?? '用户'}</div>
                    <div className="settings-profile-email faint">{me?.email ?? ''}</div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setSection('appearance')}>
                    {t('account_name_edit')}
                  </Button>
                </div>

                {/* 跨设备同步 */}
                <div className="settings-group">
                  <div className="settings-group-label">{t('sync_across_devices')}</div>
                  <div className="settings-row">
                    <div>
                      <div className="settings-row-l">
                        <span className="settings-synced">{t('synced')}</span>
                        <span className="faint">{t('last_sync', { time: '08:08:32' })}</span>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" icon={<RefreshCw size={14} className={syncing ? 'spin' : ''} />} onClick={handleSync}>
                      {syncing ? '同步中…' : t('sync_now')}
                    </Button>
                  </div>
                </div>

                {/* 账号安全 */}
                <div className="settings-group">
                  <div className="settings-group-label">{t('account_security')}</div>
                  <div className="settings-row">
                    <div>
                      <div className="settings-row-l">{t('two_factor')}</div>
                      <div className="settings-row-d faint">{t('two_factor_hint')}</div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={handleSetupAuthenticator}>{t('setup_authenticator')}</Button>
                  </div>
                </div>

                {/* 危险操作 */}
                <div className="settings-group">
                  <div className="settings-group-label">{t('danger_zone')}</div>
                  <div className="settings-row">
                    <div>
                      <div className="settings-row-l">{t('sign_out')}</div>
                      <div className="settings-row-d faint">{t('sign_out_hint')}</div>
                    </div>
                    <Button variant="secondary" size="sm" icon={<LogOut size={14} />} onClick={handleSignOut}>{t('sign_out')}</Button>
                  </div>
                  <div className="settings-row">
                    <div>
                      <div className="settings-row-l">{t('delete_cloud_data')}</div>
                      <div className="settings-row-d faint">{t('delete_cloud_data_hint')}</div>
                    </div>
                    <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={handleDeleteData}>{t('delete_cloud_data')}</Button>
                  </div>
                </div>
              </>
            )}

            {section === 'appearance' && (
              <>
                <div className="settings-group">
                  <div className="settings-row">
                    <div>
                      <div className="settings-row-l">{t('set_appearance')}</div>
                      <div className="settings-row-d faint">{t('set_appearance_desc')}</div>
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

                  <div className="settings-row">
                    <div>
                      <div className="settings-row-l">{t('language_hint')}</div>
                    </div>
                    <div className="seg">
                      <button className={lang === 'zh' ? 'is-active' : ''} onClick={() => setLang('zh')}>中文</button>
                      <button className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>English</button>
                    </div>
                  </div>
                </div>

                <div className="settings-group">
                  <div className="settings-row settings-row-col">
                    <div className="settings-row-l">{t('account_name')}</div>
                    <div className="settings-name-row">
                      <div className="field" style={{ flex: 1 }}>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('account_name_edit')} />
                      </div>
                      <Button variant="primary" icon={saved ? <Check size={15} /> : undefined} onClick={saveName}>
                        {saved ? t('account_name_saved') : t('save')}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {section === 'subscription' && (
              <div className="settings-group">
                <div className="settings-row">
                  <div>
                    <div className="settings-row-l">{t('credits')}</div>
                    <div className="settings-row-d faint">{t('credits_remaining', { n: credits ?? 300 })}</div>
                  </div>
                  <Button variant="primary" size="sm" onClick={handleUpgrade}>{t('upgrade')}</Button>
                </div>
              </div>
            )}

            {(section === 'profile' || section === 'assistant' || section === 'privacy' || section === 'shortcuts' || section === 'about') && (
              <div className="settings-placeholder">
                <p className="faint">{t('feature_coming_soon')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="settings-delete-scrim" onClick={() => setShowDeleteConfirm(false)}>
          <div className="settings-delete-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>确认删除云端数据？</h3>
            <p className="faint">此操作将删除所有云端同步的数据，包括机会管线、经历库、简历等。此操作不可撤销。</p>
            <div className="settings-delete-actions">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>取消</Button>
              <Button variant="danger" onClick={confirmDelete}>确认删除</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
