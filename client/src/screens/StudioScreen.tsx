import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, FileUp, FilePlus2, CopyPlus, Upload } from 'lucide-react'
import { useT } from '../i18n/I18n'

// 新建简历的四条路径
const START_PATHS = [
  { key: 'studio_start_target', icon: Target, primary: true },
  { key: 'studio_start_import', icon: FileUp },
  { key: 'studio_start_blank', icon: FilePlus2 },
  { key: 'studio_start_copy', icon: CopyPlus, disabled: true },
]

// 我的简历的三类文档
const MINE = ['studio_home_base_kind', 'studio_home_target', 'studio_home_translation']

// 专业模板
const TEMPLATES = [
  { id: 'general', name: '通用', cat: 'ats' },
  { id: 'sidebar', name: '竖条', cat: 'experienced' },
  { id: 'center', name: '居中', cat: 'campus' },
  { id: 'compact', name: '紧凑', cat: 'experienced' },
  { id: 'blocks', name: '色块', cat: 'ats' },
  { id: 'plain', name: '素净', cat: 'experienced' },
  { id: 'airy', name: '疏排', cat: 'campus' },
  { id: 'outline', name: '描框', cat: 'ats' },
  { id: 'tint', name: '浅底', cat: 'ats' },
  { id: 'cream', name: '米色纸', cat: 'campus' },
  { id: 'enbiz', name: '英文商务', cat: 'international' },
  { id: 'skills', name: '技能分栏', cat: 'international' },
]

const FILTERS = [
  { id: 'all', key: 'studio_template_filter_all' },
  { id: 'ats', key: 'studio_template_filter_ats' },
  { id: 'campus', key: 'studio_template_filter_campus' },
  { id: 'experienced', key: 'studio_template_filter_experienced' },
  { id: 'international', key: 'studio_template_filter_international' },
]

function MiniPaper({ variant = 0 }: { variant?: number }) {
  // 用纯 CSS 画出简历缩略图骨架
  return (
    <div className={`tpl-mini tf-${variant}`}>
      <div className="tpl-h" />
      <div className="tpl-line" />
      <div className="tpl-line is-short" />
      <div className="tpl-line" />
      <div className="tpl-line" />
      <div className="tpl-line is-short" />
    </div>
  )
}

export function StudioScreen() {
  const t = useT()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')

  const templates = useMemo(
    () => (filter === 'all' ? TEMPLATES : TEMPLATES.filter((x) => x.cat === filter)),
    [filter],
  )

  return (
    <div className="page studio">
      {/* 新建简历 */}
      <section className="rshome-block">
        <div className="rshome-section-head">
          <h2 className="rshome-section-t">{t('studio_home_new')}</h2>
        </div>
        <div className="rshome-start-paths">
          {START_PATHS.map((p) => {
            const Icon = p.icon
            return (
              <button
                key={p.key}
                className={`rshome-start-path ${p.primary ? 'is-primary' : ''} ${p.disabled ? 'is-disabled' : ''}`}
                disabled={p.disabled}
                onClick={() => p.key === 'studio_start_target' && navigate('/app/pipeline')}
              >
                <span className="rshome-start-icon">
                  <Icon size={18} />
                </span>
                <span className="rshome-start-go">{t(p.key)}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* 我的简历 */}
      <section className="rshome-block">
        <div className="rshome-section-head">
          <h2 className="rshome-section-t">{t('studio_home_library')}</h2>
          <span className="faint rshome-section-note">{t('studio_home_note')}</span>
        </div>
        <div className="rshome-grid rshome-grid-3">
          {MINE.map((kind, i) => (
            <div className="rshome-card rshome-card-empty" key={kind}>
              <div className="rshome-card-paper">
                <MiniPaper variant={i} />
              </div>
              <div className="rshome-card-main">
                <div className="rshome-card-kind">{t(kind)}</div>
                <div className="rshome-card-state faint">{t('studio_home_not_created')}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 专业模板 */}
      <section className="rshome-block">
        <div className="rshome-section-head">
          <h2 className="rshome-section-t">{t('studio_home_templates')}</h2>
          <span className="faint rshome-section-note">{t('studio_home_templates_note')}</span>
        </div>
        <div className="rshome-template-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`chip ${filter === f.id ? 'is-on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {t(f.key)}
            </button>
          ))}
        </div>
        <div className="rshome-template-grid">
          {templates.map((tpl, i) => (
            <div className="rshome-template" key={tpl.id}>
              <div className="rshome-template-paper">
                <MiniPaper variant={i % 6} />
              </div>
              <div className="rshome-template-copy">
                <span className="tpl-name">{tpl.name}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
