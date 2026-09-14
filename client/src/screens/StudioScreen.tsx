import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, FileUp, FilePlus2, CopyPlus, ChevronRight, FileText, Briefcase, Languages, Check, X, Sparkles, Loader2 } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { Button } from '../components/Button'
import { generateResume, pollTask } from '../lib/agent'
import { createResume, getResume, listResumes, type Resume } from '../services/resumes'

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
  const [myResumes, setMyResumes] = useState<Resume[]>([])
  const [loadingResumes, setLoadingResumes] = useState(true)
  const [openedResume, setOpenedResume] = useState<Resume | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [aiRole, setAiRole] = useState('')
  const [aiJd, setAiJd] = useState('')
  const [aiStatus, setAiStatus] = useState<'idle' | 'running' | 'done' | 'failed'>('idle')
  const [aiError, setAiError] = useState<string | null>(null)

  const templates = useMemo(
    () => (filter === 'all' ? TEMPLATES : TEMPLATES.filter((x) => x.cat === filter)),
    [filter],
  )

  const refreshResumes = async () => {
    setLoadingResumes(true)
    try {
      setMyResumes(await listResumes())
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : '简历列表加载失败')
    } finally {
      setLoadingResumes(false)
    }
  }

  useEffect(() => { void refreshResumes() }, [])

  const handleStartPath = async (key: string) => {
    if (key === 'studio_start_target') {
      navigate('/app/pipeline')
    } else if (key === 'studio_start_import') {
      alert('请粘贴简历文本，AI 将自动解析并生成结构化简历')
    } else if (key === 'studio_start_blank') {
      try {
        await createResume({ title: '未命名简历', templateId: 'default', content: {} })
        await refreshResumes()
        setCreating(true)
        setTimeout(() => setCreating(false), 1000)
      } catch (e) {
        setOpenError(e instanceof Error ? e.message : '创建简历失败')
      }
    }
  }
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

  // AI 生成简历：入队 → 异步任务轮询 → 产物回填
  const startAiGenerate = async () => {
    const role = aiRole.trim()
    if (!role || aiStatus === 'running') return
    setAiStatus('running')
    setAiError(null)
    try {
      const { taskId } = await generateResume(role, aiJd.trim() || undefined)
      const task = await pollTask(taskId, (t) => {
        if (t.status === 'failed') setAiError(t.error ?? '生成失败')
      })
      if (task.status === 'done') {
        const resumeId = task.output?.resumeId ?? Date.now().toString()
        const title = task.output?.title ?? `${role}·AI 简历`
        setMyResumes((prev) => [{
          id: resumeId,
          kind: 'studio_home_target',
          name: title,
          updated: '刚刚',
        }, ...prev])
        setAiStatus('done')
      } else {
        setAiStatus('failed')
        if (!aiError) setAiError(task.error ?? '生成失败，请稍后重试')
      }
    } catch (e) {
      setAiStatus('failed')
      setAiError(e instanceof Error ? e.message : '生成失败，请稍后重试')
    }
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

      {/* AI 生成简历 */}
      <section className="rshome-block">
        <div className="rshome-section-head">
          <h2 className="rshome-section-t"><Sparkles size={16} style={{ verticalAlign: '-2px', marginRight: 6 }} />AI 生成简历</h2>
          <span className="faint rshome-section-note">输入目标岗位与 JD，后台 Agent 生成后自动回填到我的简历</span>
        </div>
        <div className="rshome-ai-gen">
          <div className="rshome-ai-gen-fields">
            <input
              className="rshome-ai-gen-input"
              placeholder="目标岗位，如：大厂后端工程师"
              value={aiRole}
              onChange={(e) => setAiRole(e.target.value)}
              maxLength={100}
            />
            <textarea
              className="rshome-ai-gen-input rshome-ai-gen-jd"
              placeholder="岗位 JD（可选，粘贴职位描述）"
              value={aiJd}
              onChange={(e) => setAiJd(e.target.value)}
              maxLength={5000}
              rows={2}
            />
          </div>
          <div className="rshome-ai-gen-bar">
            {aiStatus === 'running' && <span className="rshome-ai-gen-state"><Loader2 size={14} className="spin" /> 生成中，后台异步处理…</span>}
            {aiStatus === 'done' && <span className="rshome-ai-gen-state is-ok"><Check size={14} /> 已生成并回填</span>}
            {aiError && <span className="rshome-ai-gen-state is-err">{aiError}</span>}
            <span className="grow" />
            <Button variant="primary" size="sm" onClick={startAiGenerate} disabled={!aiRole.trim() || aiStatus === 'running'}>
              {aiStatus === 'running' ? '生成中…' : 'AI 生成'}
            </Button>
          </div>
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
