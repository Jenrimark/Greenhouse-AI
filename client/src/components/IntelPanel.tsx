import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, Sparkles, ChevronRight, Sparkles as SparklesIcon, Loader2 } from 'lucide-react'
import { useT, useI18n } from '../i18n/I18n'
import { PixelAvatar } from './PixelAvatar'
import { Button } from './Button'
import { useLazyData } from '../lib/lazyData'

// interview-focus 的行业分组映射
const INTERVIEW_GROUP: Record<string, string> = {
  internet: 'b', finance: 'I', retail: 'a', advertising: 'c', film: 'd',
  consulting: 'e', gaming: 'f', manufacturing: 'g',
}

interface IntelPanelProps {
  roleId: string
  industryId: string
  onSelectRole: (roleId: string) => void
  onClose: () => void
}

export function IntelPanel({ roleId, industryId, onSelectRole, onClose }: IntelPanelProps) {
  const t = useT()
  const { lang } = useI18n()
  const navigate = useNavigate()
  const { data: ds, ready } = useLazyData(['catalog', 'flow-maps', 'flow-node-map', 'interview-focus', 'level-focus'])
  const [generating, setGenerating] = useState(false)
  const [planGenerated, setPlanGenerated] = useState(false)

  const catalog = ds.catalog as any
  const ALL_ROLES = ready ? (catalog?.ALL_CAT_ROLES as any[]) ?? [] : []
  const flowMaps = ds['flow-maps'] as any
  const flowNodeMap = ds['flow-node-map'] as any
  const interviewFocus = ds['interview-focus'] as any
  const levelFocus = ds['level-focus'] as any

  const role = useMemo(() => ALL_ROLES.find((r: any) => r.id === roleId), [ALL_ROLES, roleId])
  const flowMap = ready ? (flowMaps?.[industryId] as any) : undefined
  const nodeMap = ready ? (flowNodeMap?.[industryId] ?? {}) : {}

  // 旧 id <-> 新 id 映射
  const oldToNew = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [oldId, newId] of Object.entries(nodeMap)) map[oldId] = newId as string
    return map
  }, [nodeMap])

  const newToOld = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [oldId, newId] of Object.entries(nodeMap)) map[newId as string] = oldId
    return map
  }, [nodeMap])

  const selectedOldId = newToOld[roleId] ?? roleId

  // 同环节岗位
  const familyRoles = useMemo(() => {
    if (!role) return []
    return ALL_ROLES.filter(
      (r: any) => r.familyId === role.familyId && r.industryId === role.industryId,
    )
  }, [role])

  // 岗位特有面试重点
  const roleIntel = useMemo(() => {
    if (!role) return null
    const groupKey = INTERVIEW_GROUP[role.industryId]
    if (!groupKey) return null
    const group = (interviewFocus as any)[groupKey]
    if (!group) return null
    if (group[role.id]) return group[role.id]
    if (selectedOldId && group[selectedOldId]) return group[selectedOldId]
    return null
  }, [role, selectedOldId])

  // 按 family+职级的面试重点
  const levelIntel = useMemo(() => {
    if (!role) return null
    const familyData = (levelFocus as any)[role.familyId]
    if (!familyData) return null
    return familyData.ic3 ?? null
  }, [role])

  // 上下游交接
  const upstream = useMemo(() => {
    if (!flowMap) return []
    return (flowMap.handoffs ?? [])
      .filter((h: any) => oldToNew[h.to] === roleId || h.to === roleId || h.to === selectedOldId)
      .map((h: any) => ({ ...h, from: oldToNew[h.from] ?? h.from }))
  }, [flowMap, roleId, selectedOldId, oldToNew])

  const downstream = useMemo(() => {
    if (!flowMap) return []
    return (flowMap.handoffs ?? [])
      .filter((h: any) => oldToNew[h.from] === roleId || h.from === roleId || h.from === selectedOldId)
      .map((h: any) => ({ ...h, to: oldToNew[h.to] ?? h.to }))
  }, [flowMap, roleId, selectedOldId, oldToNew])

  // 职业发展路径
  const mobility = useMemo(() => {
    if (!flowMap?.mobility) return []
    return flowMap.mobility
      .filter((m: any) => oldToNew[m.to] === roleId || oldToNew[m.from] === roleId)
      .map((m: any) => ({ ...m, from: oldToNew[m.from] ?? m.from, to: oldToNew[m.to] ?? m.to }))
  }, [flowMap, roleId, oldToNew])

  if (!ready || !role) return null

  const roleOld = flowMap?.roles?.find((r: any) => r.id === selectedOldId)
  const socCode = roleOld?.soc ?? '—'
  const roleTurns = roleOld?.turns?.[lang] ?? role.gist[lang]

  return (
    <aside className="axp-intel-panel">
      <div className="axp-intel-header">
        <Button variant="secondary" size="sm" onClick={() => navigate(`/app/atlas/${roleId}`)}>
          查看岗位详情
          <ChevronRight size={14} />
        </Button>
        <button className="axp-intel-close" onClick={onClose}>×</button>
      </div>

      <div className="axp-intel-body">
        {/* 岗位信息卡 */}
        <div className="axp-intel-role-card">
          <div className="axp-intel-role-meta">
            <span className="axp-intel-brand">GREENROOM</span>
            <span className="axp-intel-code">GR-INT-01</span>
          </div>
          <h3 className="axp-intel-role-name">{role.name[lang]}</h3>
          <div className="axp-intel-role-en">{role.name.en}</div>
          <div className="axp-intel-role-tags">
            <span className="axp-intel-tag">{role.familyName[lang]}</span>
            <span className="axp-intel-tag">
              职业分类码 {socCode}
            </span>
          </div>
          <p className="axp-intel-role-turns">{roleTurns}</p>
          <div className="axp-intel-role-count">本环节包含 {familyRoles.length} 个岗位</div>
        </div>

        {/* 同环节岗位列表 */}
        <div className="axp-intel-section">
          <div className="axp-intel-mates">
            {familyRoles.map((r: any) => (
              <button
                key={r.id}
                className={`axp-intel-mate-btn ${r.id === roleId ? 'is-active' : ''}`}
                onClick={() => onSelectRole(r.id)}
              >
                <div className="axp-intel-mate-top">
                  <span className="axp-intel-mate-name">{r.name[lang]}</span>
                  <span className="axp-intel-mate-badges">
                    {r.hot && <Flame size={11} className="axp-badge-hot" />}
                    {r.emerging && <Sparkles size={11} className="axp-badge-new" />}
                  </span>
                </div>
                <div className="axp-intel-mate-gist">{r.gist[lang]}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 面试重点 */}
        <div className="axp-intel-section">
          <h4 className="axp-intel-section-h">面试重点</h4>
          <p className="axp-intel-text">
            {roleIntel?.screens?.[lang] ?? levelIntel?.focus?.[lang] ?? t('atlas_no_intel')}
          </p>
        </div>

        {/* 高频问题 */}
        {roleIntel?.asks?.length > 0 && (
          <div className="axp-intel-section">
            <h4 className="axp-intel-section-h">高频问题</h4>
            <ul className="axp-intel-list">
              {roleIntel.asks.map((q: any, i: number) => (
                <li key={i}>{q[lang]}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 专业视角 */}
        {roleIntel?.insider && (
          <div className="axp-intel-section">
            <h4 className="axp-intel-section-h">专业视角</h4>
            <p className="axp-intel-text">{roleIntel.insider[lang]}</p>
          </div>
        )}

        {/* 追问 */}
        {roleIntel?.followups?.length > 0 && (
          <div className="axp-intel-section">
            <h4 className="axp-intel-section-h">追问</h4>
            <ul className="axp-intel-list">
              {roleIntel.followups.map((q: any, i: number) => (
                <li key={i}>{q[lang]}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 上游交接 */}
        {upstream.length > 0 && (
          <div className="axp-intel-section">
            <h4 className="axp-intel-section-h">上游交接</h4>
            <div className="axp-intel-handoffs">
              {upstream.map((h: any, i: number) => {
                const fromRole = ALL_ROLES.find((r: any) => r.id === h.from)
                const isFeedback = h.conf === 'high' && h.src === 'manual'
                return (
                  <button key={i} className="axp-intel-handoff-btn" onClick={() => onSelectRole(h.from)}>
                    <div className="axp-intel-handoff-top">
                      <span className="axp-intel-handoff-name">{fromRole?.name[lang] ?? h.from}</span>
                      {isFeedback && <span className="axp-intel-handoff-tag">反馈回路</span>}
                    </div>
                    <div className="axp-intel-handoff-gives">{h.gives[lang]}</div>
                    <div className="axp-intel-handoff-src">行业资料整理</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 下游交接 */}
        {downstream.length > 0 && (
          <div className="axp-intel-section">
            <h4 className="axp-intel-section-h">下游交接</h4>
            <div className="axp-intel-handoffs">
              {downstream.map((h: any, i: number) => {
                const toRole = ALL_ROLES.find((r: any) => r.id === h.to)
                return (
                  <button key={i} className="axp-intel-handoff-btn" onClick={() => onSelectRole(h.to)}>
                    <div className="axp-intel-handoff-top">
                      <span className="axp-intel-handoff-name">{toRole?.name[lang] ?? h.to}</span>
                    </div>
                    <div className="axp-intel-handoff-gives">{h.gives[lang]}</div>
                    <div className="axp-intel-handoff-src">公开招聘信息</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 职业发展路径 */}
        {mobility.length > 0 && (
          <div className="axp-intel-section">
            <h4 className="axp-intel-section-h">职业发展路径</h4>
            <p className="axp-intel-note">展示岗位之间常见的转岗与晋升方向，并与业务流程中的工作交接分别说明。</p>
            <div className="axp-intel-mobility">
              {mobility.map((m: any, i: number) => {
                const fromRole = ALL_ROLES.find((r: any) => r.id === m.from)
                const toRole = ALL_ROLES.find((r: any) => r.id === m.to)
                const isTarget = m.to === roleId
                return (
                  <button key={i} className="axp-intel-mobility-btn" onClick={() => onSelectRole(isTarget ? m.from : m.to)}>
                    <span className="axp-intel-mobility-from">{fromRole?.name[lang] ?? m.from}</span>
                    <span className="axp-intel-mobility-to">{toRole?.name[lang] ?? m.to}</span>
                    <span className="axp-intel-mobility-note">{m.note[lang]}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 底部生成准备计划 */}
      <div className="axp-intel-footer">
        {planGenerated ? (
          <div className="axp-plan-result">
            <div className="axp-plan-result-h">
              <SparklesIcon size={14} /> 准备计划已生成
            </div>
            <div className="axp-plan-steps">
              <div className="axp-plan-step">
                <span className="axp-plan-step-n">1</span>
                <span>梳理 3 个与目标岗位匹配的项目经历</span>
              </div>
              <div className="axp-plan-step">
                <span className="axp-plan-step-n">2</span>
                <span>针对高频问题准备 STAR 结构回答</span>
              </div>
              <div className="axp-plan-step">
                <span className="axp-plan-step-n">3</span>
                <span>完成 1 次模拟面试并获取评分反馈</span>
              </div>
              <div className="axp-plan-step">
                <span className="axp-plan-step-n">4</span>
                <span>优化简历关键词，提升 ATS 匹配度</span>
              </div>
            </div>
            <Button variant="secondary" size="sm" full onClick={() => navigate('/app/mock')}>
              开始模拟面试
            </Button>
          </div>
        ) : (
          <>
            <div className="axp-intel-footer-label">根据这些信息生成准备计划</div>
            <Button
              variant="primary"
              icon={generating ? <Loader2 size={15} className="spin" /> : <SparklesIcon size={15} />}
              full
              disabled={generating}
              onClick={() => {
                setGenerating(true)
                setTimeout(() => {
                  setGenerating(false)
                  setPlanGenerated(true)
                }, 1500)
              }}
            >
              {generating ? '生成中…' : '生成准备计划'}
            </Button>
          </>
        )}
      </div>
    </aside>
  )
}
