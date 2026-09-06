import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n/I18n'
import { api } from '../lib/api'
import { Button } from '../components/Button'

type Mode = 'login' | 'register'

export function LoginScreen() {
  const t = useT()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) {
      setError(t('auth_err_email'))
      return
    }
    if (password.length < 8) {
      setError(t('auth_err_pw_min'))
      return
    }
    setLoading(true)
    setError('')
    try {
      if (mode === 'register') {
        await api.post('/api/auth/register', { email, password, name: name.trim() || undefined })
        // 注册成功后自动登录
        await api.post('/api/auth/login', { email, password })
      } else {
        await api.post('/api/auth/login', { email, password })
      }
      navigate('/app')
    } catch (err: any) {
      const msg = err?.message || t('auth_err_bad')
      setError(mode === 'register' && /已注册/i.test(msg) ? t('auth_err_exists') : msg)
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <img src="/icon.svg" width={48} height={48} alt="Greenroom" className="auth-logo" />
        <h1 className="auth-h">{t(mode === 'login' ? 'auth_login_h' : 'auth_signup_h')}</h1>
        <p className="auth-sub faint">{t('auth_sub')}</p>

        {mode === 'register' && (
          <label className="modal-field">
            <span className="modal-label">{t('auth_name')}</span>
            <input
              className="modal-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="吴汉东"
              autoComplete="name"
            />
          </label>
        )}
        <label className="modal-field">
          <span className="modal-label">{t('auth_email')}</span>
          <input
            className="modal-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>
        <label className="modal-field">
          <span className="modal-label">{t('auth_pw')}</span>
          <input
            className="modal-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
        </label>

        {error && <div className="modal-error">{error}</div>}

        <Button variant="primary" size="lg" full type="submit" disabled={loading}>
          {loading ? t(mode === 'register' ? 'auth_creating' : 'auth_loggingin') : t(mode === 'register' ? 'auth_signup_cta' : 'auth_login_cta')}
        </Button>

        {mode === 'register' && (
          <p className="auth-terms">
            {t('auth_terms_pre')}
            <a href="/privacy" onClick={(e) => e.preventDefault()}>隐私政策</a>
            {t('auth_terms_mid')}
            <a href="/terms" onClick={(e) => e.preventDefault()}>用户协议</a>
            {t('auth_terms_end')}
          </p>
        )}

        <button
          type="button"
          className="link-btn auth-toggle"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError('')
          }}
        >
          {t(mode === 'login' ? 'auth_toggle_signup_q' : 'auth_toggle_login_q')}
        </button>
      </form>
    </div>
  )
}
