import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Flame, Sparkles, Table2, Sparkles as SparklesIcon } from 'lucide-react'
import { useT, useI18n } from '../i18n/I18n'
import { PixelAvatar } from '../components/PixelAvatar'
import { Button } from '../components/Button'
import { useLazyData } from '../lib/lazyData'

// 中国公司列表（前10个）
const CN_COMPANIES = ['alibaba', 'bytedance', 'tencent', 'meituan', 'baidu', 'jd', 'netease', 'kuaishou', 'didi', 'xiaomi']
const COMPANY_NAMES: Record<string, string> = {
  alibaba: '阿里巴巴', bytedance: '字节跳动', tencent: '腾讯', meituan: '美团',
  baidu: '百度', jd: '京东', netease: '网易', kuaishou: '快手', didi: '滴滴', xiaomi: '小米',
  google: 'Google', meta: 'Meta', amazon: 'Amazon', apple: 'Apple', microsoft: 'Microsoft',
  nvidia: 'NVIDIA', netflix: 'Netflix',
}

// interview-focus 的行业分组映射（industryId -> group key）
const INTERVIEW_GROUP: Record<string, string> = {
  internet: 'b', finance: 'I', retail: 'a', advertising: 'c', film: 'd',
  consulting: 'e', gaming: 'f', manufacturing: 'g',
}

function RoleMarks({ role }: { role: any }) {
  const t = useT()
  return (
    <span className="axp-rc-mk">
      {role.hot && (
        <>
          <Flame size={12} />
          <span className="sr-only">{t('atlas_hot')}</span>
        </>
      )}
      {role.emerging && (
        <>
          <Sparkles size={12} />
          <span className="sr-only">{t('atlas_new')}</span>
        </>
      )}
    </span>
  )
}

export function RoleDetailScreen() {
  const { roleId } = useParams<{ roleId: string }>()
  const navigate = useNavigate()
  const t = useT()
  const { lang } = useI18n()
  const { data: ds, ready } = useLazyData(['catalog', 'ladders', 'company-levels', 'interview-focus', 'flow-maps', 'flow-node-map', 'level-focus'])
  const [levelIdx, setLevelIdx] = useState(2) // 默认高级 ic3
  const [showFullMatrix, setShowFullMatrix] = useState(false)

  const catalog = ds.catalog as any
  const ALL_ROLES = ready ? (catalog?.ALL_CAT_ROLES as any[]) ?? [] : []
  const INDUSTRIES = ready ? (catalog?.CATALOG_INDUSTRIES as any[]) ?? [] : []
  const ladders = ds.ladders as any
  const LADDER = ready ? ((ladders as any)?.default ?? ladders ?? []) : []
  const companyLevels = ds['company-levels'] as any
  const interviewFocus = ds['interview-focus'] as any
  const flowMaps = ds['flow-maps'] as any
  const flowNodeMap = ds['flow-node-map'] as any
  const levelFocus = ds['level-focus'] as any

  const role = useMemo(() => ALL_ROLES.find((r) => r.id === roleId), [ALL_ROLES, roleId])
  const industry = useMemo(() => (role ? INDUSTRIES.find((i) => i.id === role.industryId) : null), [INDUSTRIES, role])

  // 职级阶梯（前4级：初级/中级/高级/资深）
  const levels = useMemo(() => {
    const arr = Array.isArray(LADDER) ? LADDER : Object.values(LADDER)
    return arr.filter((l: any) => l.track === 'ic' && l.ordinal <= 4).sort((a: any, b: any) => a.ordinal - b.ordinal)
  }, [LADDER])

  const currentLevel = levels[levelIdx]

  // 面试重点数据（按 family + 职级）
  const levelFocusData = useMemo(() => {
    if (!role || !currentLevel) return null
    const familyData = (levelFocus as any)[role.familyId]
    if (!familyData) return null
    return familyData[currentLevel.id] ?? null
  }, [role, currentLevel])

  // 岗位特有的面试重点（interview-focus，需要旧 id 映射）
  const interviewData = useMemo(() => {
    if (!role) return null
    const groupKey = INTERVIEW_GROUP[role.industryId]
    if (!groupKey) return null
    const group = (interviewFocus as any)[groupKey]
    if (!group) return null
    // 直接用新 id 查找
    if (group[role.id]) return group[role.id]
    // 用 flow-node-map 反向映射：新 id -> 旧 id
    const nodeMap = (flowNodeMap as any)[role.industryId]
    if (nodeMap) {
      const oldId = Object.entries(nodeMap).find(([, v]) => v === role.id)?.[0]
      if (oldId && group[oldId]) return group[oldId]
    }
    return null
  }, [role])

  // 运转图数据
  const flowMap = useMemo(() => {
    if (!role) return null
    return (flowMaps as any)[role.industryId] ?? null
  }, [role])

  // 环节（family）
  const slot = useMemo(() => {
    if (!role) return null
    return {
      id: role.familyId,
      label: role.familyName,
      note: flowMap?.slots?.find((s: any) => s.id === role.familyId)?.note ?? { zh: '', en: '' },
    }
  }, [role, flowMap])

  // 旧 id -> 新 id 映射
  const oldToNew = useMemo(() => {
    if (!role) return {}
    const nodeMap = (flowNodeMap as any)[role.industryId]
    if (!nodeMap) return {}
    const map: Record<string, string> = {}
    for (const [oldId, newId] of Object.entries(nodeMap)) {
      map[oldId] = newId as string
    }
    return map
  }, [role])

  // 上下游交接（映射旧 id 到新 id）
  const upstream = useMemo(() => {
    if (!flowMap || !role) return []
    return (flowMap.handoffs ?? [])
      .filter((h: any) => oldToNew[h.to] === role.id || h.to === role.id)
      .map((h: any) => ({
        ...h,
        from: oldToNew[h.from] ?? h.from,
      }))
  }, [flowMap, role, oldToNew])

  const downstream = useMemo(() => {
    if (!flowMap || !role) return []
    return (flowMap.handoffs ?? [])
      .filter((h: any) => oldToNew[h.from] === role.id || h.from === role.id)
      .map((h: any) => ({
        ...h,
        to: oldToNew[h.to] ?? h.to,
      }))
  }, [flowMap, role, oldToNew])

  // 同环节其他岗位（从 catalog 中按 familyId 查找）
  const slotMates = useMemo(() => {
    if (!role) return []
    return ALL_ROLES.filter(
      (r: any) => r.familyId === role.familyId && r.industryId === role.industryId && r.id !== role.id,
    )
  }, [role])

  // 公司职级对照
  const levelCompanies = useMemo(() => {
    if (!currentLevel) return []
    return (companyLevels as any)[currentLevel.id] ?? []
  }, [currentLevel])

  const cnCompanies = levelCompanies.filter((c: any) => CN_COMPANIES.includes(c.company))
  const intlCompanies = levelCompanies.filter((c: any) => !CN_COMPANIES.includes(c.company))

  if (!ready) {
    return (
      <div className="page">
        <p>数据加载中…</p>
      </div>
    )
  }

  if (!role) {
    return (
      <div className="page">
        <p>岗位未找到</p>
        <Button onClick={() => navigate('/app/atlas')}>返回岗位地图</Button>
      </div>
    )
  }

  return (
    <div className="page role-detail">
      {/* 面包屑 */}
      <div className="axp-breadcrumb">
        <button className="axp-back" onClick={() => navigate('/app/atlas')}>
          <ArrowLeft size={15} />
          {t('back')}
        </button>
        <span className="axp-bc-sep">/</span>
        <span className="axp-bc-industry">{industry?.name[lang] ?? role.industryName[lang]}</span>
        {slot && (
          <>
            <span className="axp-bc-sep">›</span>
            <span className="axp-bc-slot">{slot.label[lang]}</span>
          </>
        )}
      </div>

      {/* 岗位头部 */}
      <div className="axp-header">
        <div className="axp-header-left">
          <span className="axp-avatar">
            <PixelAvatar seed={role.id} size={52} />
          </span>
          <div className="axp-header-info">
            <h1 className="axp-title">
              {role.name[lang]}
              <RoleMarks role={role} />
            </h1>
            {role.name.en !== role.name[lang] && (
              <div className="axp-alias-en">{role.name.en}</div>
            )}
            <p className="axp-gist">{role.gist[lang]}</p>
            {role.aliases?.length > 0 && (
              <div className="axp-aliases">
                <span className="axp-aliases-label">{t('atlas_aka')}</span>
                {role.aliases.map((a: string) => (
                  <span key={a} className="axp-alias-chip">{a}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <span className="axp-pro-badge">{t('axp_pro_badge')}</span>
      </div>

      {/* 职级阶梯 */}
      <section className="axp-section">
        <h2 className="axp-section-h">
          <Table2 size={16} />
          {t('axp_ladder')}
        </h2>
        <p className="axp-section-note">{t('axp_ladder_note')}</p>
        <div className="axp-levels">
          {levels.map((lv: any, idx: number) => (
            <button
              key={lv.id}
              className={`axp-level-card ${idx === levelIdx ? 'is-active' : ''}`}
              onClick={() => setLevelIdx(idx)}
            >
              <div className="axp-level-name">
                {lv.name[lang]}
                {lv.ordinal === 3 && <span className="axp-level-star">★</span>}
              </div>
              <div className="axp-level-yoe">{lv.yoe}</div>
              {lv.ordinal === 3 && (
                <div className="axp-level-terminal">{t('axp_terminal')}</div>
              )}
            </button>
          ))}
        </div>

        {/* 过了资深往上两条路 */}
        <p className="axp-beyond-senior">{t('axp_beyond_senior')}</p>
        <div className="axp-tracks">
          <div className="axp-track-card">
            <div className="axp-track-label">{t('axp_pro_track')}</div>
            <div className="axp-track-title">{t('axp_pro_title')}</div>
            <div className="axp-track-desc">{t('axp_pro_desc')}</div>
          </div>
          <div className="axp-track-card axp-track-mgmt">
            <div className="axp-track-label">{t('axp_mgmt_track')}</div>
            <div className="axp-track-title">{t('axp_mgmt_title')}</div>
            <div className="axp-track-desc">{t('axp_mgmt_desc')}</div>
          </div>
        </div>
      </section>

      {/* 当前职级详情 */}
      {currentLevel && (
        <section className="axp-level-detail card">
          <div className="axp-ld-head">
            <span className="axp-ld-level">{currentLevel.name[lang]}</span>
            <span className="axp-ld-role">{role.name[lang]}</span>
            <span className="axp-ld-yoe">
              {t('axp_yoe')} {currentLevel.yoe}
            </span>
          </div>
          <p className="axp-ld-desc">{t(`axp_level_desc_${currentLevel.id}`)}</p>
          <div className="axp-ld-grid">
            <div className="axp-ld-item">
              <div className="axp-ld-label">{t('axp_scope')}</div>
              <div className="axp-ld-value">{currentLevel.scope[lang]}</div>
            </div>
            <div className="axp-ld-item">
              <div className="axp-ld-label">{t('axp_autonomy')}</div>
              <div className="axp-ld-value">{currentLevel.autonomy[lang]}</div>
            </div>
            <div className="axp-ld-item">
              <div className="axp-ld-label">{t('axp_ambiguity')}</div>
              <div className="axp-ld-value">{currentLevel.ambiguity[lang]}</div>
            </div>
            <div className="axp-ld-item">
              <div className="axp-ld-label">{t('axp_impact')}</div>
              <div className="axp-ld-value">{currentLevel.impact[lang]}</div>
            </div>
          </div>

          {/* 面试重点 */}
          <div className="axp-ld-screen">
            <div className="axp-ld-label">{t('axp_level_screen')}</div>
            {levelFocusData?.focus ? (
              <div className="axp-ld-value">{levelFocusData.focus[lang]}</div>
            ) : interviewData?.screens ? (
              <div className="axp-ld-value">{interviewData.screens[lang]}</div>
            ) : (
              <div className="axp-ld-value faint">{t('atlas_no_intel')}</div>
            )}
          </div>

          {/* 晋升关键 */}
          <div className="axp-ld-leap">
            <span className="axp-ld-label">{t('axp_leap')}</span>
            <span className="axp-ld-value">
              {currentLevel.ordinal === 1 && '从"需要指导"到"独立交付"'}
              {currentLevel.ordinal === 2 && '从"独立交付"到"跨人协作与模块负责"'}
              {currentLevel.ordinal === 3 && '从"独立交付"跃迁到"定义该做什么 + 带小团队"'}
              {currentLevel.ordinal === 4 && '从"带小团队"到"扛复杂系统/跨团队项目，成为技术支柱"'}
            </span>
          </div>
        </section>
      )}

      {/* 不同公司的对应职级 */}
      <section className="axp-section">
        <h2 className="axp-section-h">{t('axp_across_co')}</h2>
        <p className="axp-section-note">{t('axp_across_co_note')}</p>

        <div className="axp-companies">
          <div className="axp-co-region">
            <div className="axp-co-region-label">{t('axp_cn')}</div>
            <div className="axp-co-grid">
              {cnCompanies.map((c: any) => (
                <div key={c.company} className="axp-co-item">
                  <span className="axp-co-name">{COMPANY_NAMES[c.company] ?? c.company}</span>
                  <span className="axp-co-code">
                    {c.code}
                    {c.legacy && <span className="axp-co-legacy">旧 {c.legacy}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="axp-co-region">
            <div className="axp-co-region-label">{t('axp_intl')}</div>
            <div className="axp-co-grid">
              {intlCompanies.map((c: any) => (
                <div key={c.company} className="axp-co-item">
                  <span className="axp-co-name">{COMPANY_NAMES[c.company] ?? c.company}</span>
                  <span className="axp-co-code">{c.code}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {showFullMatrix && (
          <div className="axp-matrix-table">
            <table>
              <thead>
                <tr>
                  <th>{t('axp_mx_level')}</th>
                  {levels.map((lv: any) => (
                    <th key={lv.id}>{lv.name[lang]} {lv.yoe}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {levelCompanies.map((c: any) => (
                  <tr key={c.company}>
                    <td>{COMPANY_NAMES[c.company] ?? c.company}</td>
                    {levels.map((lv: any) => {
                      const lvCo = ((companyLevels as any)[lv.id] ?? []).find((x: any) => x.company === c.company)
                      return <td key={lv.id}>{lvCo?.code ?? '—'}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button className="axp-matrix-toggle" onClick={() => setShowFullMatrix(!showFullMatrix)}>
          {showFullMatrix ? t('axp_matrix_hide') : t('axp_matrix_show')}
          <ChevronRight size={14} className={showFullMatrix ? 'rotated' : ''} />
        </button>
      </section>

      {/* 岗位在运转图中的位置 */}
      {slot && (
        <section className="axp-section">
          <h2 className="axp-section-h">{t('axp_where_in_map')}</h2>
          <div className="axp-flow-pos">
            <div className="axp-flow-industry">
              <span className="axp-flow-ind-name">{industry?.name[lang] ?? role.industryName[lang]}</span>
              <span className="axp-flow-sep">/</span>
              <span className="axp-flow-slot-name">{slot.label[lang]}</span>
              {slot.note?.[lang] && <span className="axp-flow-slot-note">{slot.note[lang]}</span>}
            </div>

            {upstream.length > 0 && (
              <div className="axp-flow-handoff">
                <div className="axp-flow-h-label">{t('atlas_upstream')}</div>
                {upstream.map((h: any) => {
                  const fromRole = ALL_ROLES.find((r: any) => r.id === h.from)
                  return (
                    <div key={h.from} className="axp-flow-h-item">
                      <span className="axp-flow-h-role">{fromRole?.name[lang] ?? h.from}</span>
                      <span className="axp-flow-h-gives">{h.gives[lang]}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {downstream.length > 0 && (
              <div className="axp-flow-handoff">
                <div className="axp-flow-h-label">{t('atlas_downstream')}</div>
                {downstream.map((h: any) => {
                  const toRole = ALL_ROLES.find((r: any) => r.id === h.to)
                  return (
                    <div key={h.to} className="axp-flow-h-item">
                      <span className="axp-flow-h-role">{toRole?.name[lang] ?? h.to}</span>
                      <span className="axp-flow-h-gives">{h.gives[lang]}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {slotMates.length > 0 && (
              <div className="axp-flow-mates">
                <div className="axp-flow-mates-label">
                  {t('axp_mates_n', { n: slotMates.length })}
                </div>
                <div className="axp-flow-mates-list">
                  {slotMates.slice(0, 9).map((r: any) => (
                    <button
                      key={r.id}
                      className="axp-flow-mate-btn"
                      onClick={() => navigate(`/app/atlas/${r.id}`)}
                    >
                      {r.name[lang]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button variant="secondary" onClick={() => navigate('/app/atlas')}>
              {t('atlas_open_map')}
            </Button>
          </div>
        </section>
      )}

      {/* 生成准备计划 */}
      <div className="axp-prep">
        <Button variant="primary" icon={<SparklesIcon size={15} />}>
          {t('axp_prep_level', { name: currentLevel?.name[lang] ?? '' })}
        </Button>
      </div>
    </div>
  )
}
