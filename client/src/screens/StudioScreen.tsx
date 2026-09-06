import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, FileUp, FilePlus2, CopyPlus, ChevronRight, FileText, Briefcase, Languages, Check, X } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { Button } from '../components/Button'

// 新建简历的四条路径
const START_PATHS = [
  { key: 'studio_start_target', note: 'studio_start_target_note', icon: Target, primary: true },
  { key: 'studio_start_import', note: 'studio_start_import_note', icon: FileUp },
  { key: 'studio_start_blank', note: 'studio_start_blank_note', icon: FilePlus2 },
  { key: 'studio_start_copy', note: 'studio_start_copy_empty_note', icon: CopyPlus, disabled: true },
]

// 我的简历的三类文档
const MINE = [
  { key: 'studio_home_base_kind', icon: FileText },
  { key: 'studio_home_target', icon: Briefcase },
  { key: 'studio_home_translation', icon: Languages },
]

// 专业模板
const TEMPLATES = [
  { id: 'general', name: '通用', cat: 'ats', fit: '适合：通用投递、ATS' },
  { id: 'sidebar', name: '竖条', cat: 'experienced', fit: '适合：产品、运营、商科' },
  { id: 'center', name: '居中', cat: 'campus', fit: '适合：学生、研究、校园经历' },
  { id: 'compact', name: '紧凑', cat: 'experienced', fit: '适合：经历较多、需要压缩一页' },
  { id: 'blocks', name: '色块', cat: 'ats', fit: '适合：工程、技术、层级清晰的经历' },
  { id: 'plain', name: '素净', cat: 'experienced', fit: '适合：资深职场、克制表达' },
  { id: 'airy', name: '疏排', cat: 'campus', fit: '适合：专业简历' },
  { id: 'outline', name: '描框', cat: 'ats', fit: '适合：专业简历' },
  { id: 'tint', name: '浅底', cat: 'ats', fit: '适合：专业简历' },
  { id: 'cream', name: '米色纸', cat: 'campus', fit: '适合：专业简历' },
  { id: 'enbiz', name: '英文商务', cat: 'international', fit: '适合：专业简历' },
  { id: 'skills', name: '技能分栏', cat: 'international', fit: '适合：专业简历' },
]

const FILTERS = [
  { id: 'all', key: 'studio_template_filter_all' },
  { id: 'ats', key: 'studio_template_filter_ats' },
  { id: 'campus', key: 'studio_template_filter_campus' },
  { id: 'experienced', key: 'studio_template_filter_experienced' },
  { id: 'international', key: 'studio_template_filter_international' },
]

function MiniPaper({ variant = 0 }: { variant?: number }) {
  const lines = [0, 1, 2, 3, 4]
  return (
    <div className={`rs-mini rs-mini-${variant % 6}`}>
      <div className="rs-mh" />
      {lines.map((i) => (
        <div key={i} className={`rs-ml ${i % 2 === 1 ? 'is-short' : ''}`} />
      ))}
    </div>
  )
}

export function StudioScreen() {
  const t = useT()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [selectedTpl, setSelectedTpl] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [myResumes, setMyResumes] = useState<Array<{ id: string; kind: string; name: string; updated: string }>>([])

  const templates = useMemo(
    () => (filter === 'all' ? TEMPLATES : TEMPLATES.filter((x) => x.cat === filter)),
    [filter],
  )

  const handleStartPath = (key: string) => {
    if (key === 'studio_start_target') {
      navigate('/app/pipeline')
    } else if (key === 'studio_start_import') {
      alert('请粘贴简历文本，AI 将自动解析并生成结构化简历')
    } else if (key === 'studio_start_blank') {
      const newId = Date.now().toString()
      setMyResumes((prev) => [...prev, {
        id: newId,
        kind: 'studio_home_base_kind',
        name: '未命名简历',
        updated: '刚刚',
      }])
      setCreating(true)
      setTimeout(() => setCreating(false), 1000)
    }
  }

  const handleTemplateClick = (tpl: typeof TEMPLATES[0]) => {
    setSelectedTpl(selectedTpl === tpl.id ? null : tpl.id)
  }

  const useTemplate = (tpl: typeof TEMPLATES[0]) => {
    const newId = Date.now().toString()
    setMyResumes((prev) => [...prev, {
      id: newId,
      kind: 'studio_home_base_kind',
      name: `${tpl.name}模板简历`,
      updated: '刚刚',
    }])
    setSelectedTpl(null)
  }

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
                onClick={() => handleStartPath(p.key)}
              >
                <span className="rshome-start-icon">
                  <Icon size={18} />
                </span>
                <span className="rshome-start-copy">
                  <span className="rshome-start-go">{t(p.key)}</span>
                  <span className="rshome-start-note faint">{t(p.note)}</span>
                </span>
                <ChevronRight size={16} className="rshome-start-arrow" />
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
          {myResumes.length > 0 ? myResumes.map((r, i) => (
            <div className="rshome-card" key={r.id} onClick={() => alert(`打开简历：${r.name}`)}>
              <div className="rshome-card-paper">
                <MiniPaper variant={i % 6} />
              </div>
              <div className="rshome-card-main">
                <div className="rshome-card-kind">
                  <FileText size={15} className="rshome-card-kind-ico" />
                  {r.name}
                </div>
                <div className="rshome-card-state faint">更新于 {r.updated}</div>
              </div>
            </div>
          )) : MINE.map((kind, i) => {
            const Icon = kind.icon
            return (
              <div className="rshome-card rshome-card-empty" key={kind.key} onClick={() => handleStartPath('studio_start_blank')}>
                <div className="rshome-card-paper">
                  <MiniPaper variant={i} />
                </div>
                <div className="rshome-card-main">
                  <div className="rshome-card-kind">
                    <Icon size={15} className="rshome-card-kind-ico" />
                    {t(kind.key)}
                  </div>
                  <div className="rshome-card-state faint">{t('studio_home_not_created')}</div>
                </div>
              </div>
            )
          })}
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
            <div
              className={`rshome-template ${selectedTpl === tpl.id ? 'is-selected' : ''}`}
              key={tpl.id}
              onClick={() => handleTemplateClick(tpl)}
            >
              <div className="rshome-template-paper">
                <MiniPaper variant={i % 6} />
              </div>
              <div className="rshome-template-copy">
                <span className="tpl-name">{tpl.name}</span>
                <span className="tpl-fit faint">{tpl.fit}</span>
              </div>
              {selectedTpl === tpl.id && (
                <div className="rshome-template-actions">
                  <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); useTemplate(tpl) }}>
                    使用此模板
                  </Button>
                  <button className="iconbtn" onClick={(e) => { e.stopPropagation(); setSelectedTpl(null) }}>
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
