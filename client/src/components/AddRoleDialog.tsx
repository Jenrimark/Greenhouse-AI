import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { Button } from './Button'
import { api } from '../lib/api'

interface Props {
  onClose: () => void
  onCreated: (id: string) => void
}

/**
 * 添加岗位对话框：录入公司 / 岗位 / JD，提交到后端 /api/opportunities
 */
export function AddRoleDialog({ onClose, onCreated }: Props) {
  const t = useT()
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [jd, setJd] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = company.trim() && role.trim() && !saving

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      const res = await api.post<{ data: { id: string } }>('/api/opportunities', {
        company: company.trim(),
        role: role.trim(),
        jd: jd.trim(),
      })
      onCreated(res.data.id)
    } catch (e: any) {
      setError(e?.message || 'error')
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-card" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3 className="modal-title">{t('add_role')}</h3>
          <button className="iconbtn" onClick={onClose} aria-label={t('close')}>
            <X size={17} />
          </button>
        </div>

        <div className="modal-body">
          <label className="modal-field">
            <span className="modal-label">{t('add_role_company')}</span>
            <input
              className="modal-input"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="例如：字节跳动"
              autoFocus
            />
          </label>
          <label className="modal-field">
            <span className="modal-label">{t('add_role_role')}</span>
            <input
              className="modal-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="例如：前端开发工程师"
            />
          </label>
          <label className="modal-field">
            <span className="modal-label">{t('add_role_jd')}</span>
            <textarea
              className="modal-input modal-textarea"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="粘贴职位描述（可选，用于生成匹配度与预测面试题）"
              rows={5}
            />
          </label>
          {error && <div className="modal-error">{error}</div>}
        </div>

        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" disabled={!canSubmit} onClick={submit}>
            {saving && <Loader2 size={15} className="spin" />}
            {t('save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
