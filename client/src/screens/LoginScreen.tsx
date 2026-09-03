import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n/I18n'
import { api } from '../lib/api'
import { Button } from '../components/Button'

export function LoginScreen() {
  const t = useT()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/api/auth/login', { email, password })
      navigate('/app')
    } catch (err: any) {
      setError(err?.message || t('auth_err_bad'))
      setLoading(false)
    }
  }

  // 演示：免登录直接进入
  const guest = async () => {
    await api.post('/api/auth/guest', {}).catch(() => null)
    navigate('/app')
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <img src="/icon.svg" width={48} height={48} alt="Greenroom" className="auth-logo" />
        <h1 className="auth-h">{t('auth_login_h')}</h1>
        <p className="auth-sub faint">AI 求职作战系统</p>

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
            autoComplete="current-password"
          />
        </label>

        {error && <div className="modal-error">{error}</div>}

        <Button variant="primary" size="lg" full type="submit" disabled={loading}>
          {loading ? t('auth_loggingin') : t('auth_login_cta')}
        </Button>
        <button type="button" className="link-btn auth-guest" onClick={guest}>
          免登录体验演示数据
        </button>
      </form>
    </div>
  )
}
