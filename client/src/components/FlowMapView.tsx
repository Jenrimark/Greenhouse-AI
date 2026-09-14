import { useMemo, useState } from 'react'
import { useI18n } from '../i18n/I18n'
import { PixelAvatar } from './PixelAvatar'
import { useLazyData } from '../lib/lazyData'
import { resolveFlowMapId } from '../lib/atlasData'

// 8 环节圆形布局角度（从顶部开始顺时针）
const SLOT_ANGLES = [-90, -45, 0, 45, 90, 135, 180, -135]

interface FlowMapViewProps {
  industryId: string
  mapId?: string
  selectedRoleId: string | null
  onSelectRole: (roleId: string) => void
  onBack?: () => void
}

export function FlowMapView({ industryId, mapId, selectedRoleId, onSelectRole, onBack }: FlowMapViewProps) {
  const { lang } = useI18n()
  const { data: ds, ready, error, retry } = useLazyData(['catalog', 'flow-maps', 'flow-node-map'])
  const [zoom, setZoom] = useState(1)

  const catalog = ds.catalog as any
  const ALL_ROLES = ready ? (catalog?.ALL_CAT_ROLES as any[]) ?? [] : []
  const flowMaps = ds['flow-maps'] as any
  const flowNodeMap = ds['flow-node-map'] as any

  const resolvedMapId = mapId ?? resolveFlowMapId({ id: industryId }, flowMaps)
  const flowMap = ready ? (flowMaps?.[resolvedMapId ?? industryId] as any) : undefined
  const nodeMap = ready ? (flowNodeMap?.[resolvedMapId ?? industryId] ?? flowNodeMap?.[industryId] ?? {}) : {}

  // 旧 id -> 新 id 映射
  const oldToNew = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [oldId, newId] of Object.entries(nodeMap)) {
      map[oldId] = newId as string
    }
    return map
  }, [nodeMap])

  // 新 id -> 旧 id 映射
  const newToOld = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [oldId, newId] of Object.entries(nodeMap)) {
      map[newId as string] = oldId
    }
    return map
  }, [nodeMap])

  if (error) {
    return (
      <div className="axp-flow-empty">
        <p>运转图数据加载失败，请重试。</p>
        <button className="btn btn-secondary" type="button" onClick={retry}>重试</button>
      </div>
    )
  }

  if (!ready || !flowMap) {
    return <div className="axp-flow-empty">{ready ? '该行业暂无运转图' : '数据加载中…'}</div>
  }

  const slots = flowMap.slots ?? []
  const roles = flowMap.roles ?? []
  const handoffs = flowMap.handoffs ?? []

  // 每个环节的代表岗位
  const slotRoleMap: Record<string, any> = {}
  for (const role of roles) {
    if (!slotRoleMap[role.slot]) {
      slotRoleMap[role.slot] = role
    }
  }

  // 选中岗位的旧 id
  const selectedOldId = selectedRoleId ? (newToOld[selectedRoleId] ?? selectedRoleId) : null

  // 计算岗位位置
  const centerX = 380
  const centerY = 320
  const ringR = 180
  const nodeR = 250

  const getSlotPos = (idx: number) => {
    const angle = (SLOT_ANGLES[idx] ?? 0) * Math.PI / 180
    return {
      x: centerX + ringR * Math.cos(angle),
      y: centerY + ringR * Math.sin(angle),
      labelX: centerX + (ringR - 50) * Math.cos(angle),
      labelY: centerY + (ringR - 50) * Math.sin(angle),
      nodeX: centerX + nodeR * Math.cos(angle),
      nodeY: centerY + nodeR * Math.sin(angle),
      angle: SLOT_ANGLES[idx],
    }
  }

  // 绘制环节之间的箭头（循环飞轮）
  const renderArrows = () => {
    const arrows: JSX.Element[] = []
    for (let i = 0; i < slots.length; i++) {
      const fromSlot = slots[i]
      const toSlot = slots[(i + 1) % slots.length]
      const fromRole = slotRoleMap[fromSlot.id]
      const toRole = slotRoleMap[toSlot.id]
      if (!fromRole || !toRole) continue

      const fromPos = getSlotPos(i)
      const toPos = getSlotPos((i + 1) % slots.length)

      // 查找对应的 handoff
      const handoff = handoffs.find((h: any) => h.from === fromRole.id && h.to === toRole.id)
      const isHighlighted = selectedOldId && (fromRole.id === selectedOldId || toRole.id === selectedOldId)
      const isFeedback = handoff?.src === 'manual' && handoff?.conf === 'high' && fromRole.id === 'in-algo' && toRole.id === 'in-pm-c'

      // 弧形路径
      const midAngle = ((fromPos.angle + toPos.angle) / 2) * Math.PI / 180
      const ctrlR = ringR + 30
      const ctrlX = centerX + ctrlR * Math.cos(midAngle)
      const ctrlY = centerY + ctrlR * Math.sin(midAngle)

      const pathD = `M ${fromPos.x} ${fromPos.y} Q ${ctrlX} ${ctrlY} ${toPos.x} ${toPos.y}`

      arrows.push(
        <path
          key={`arrow-${i}`}
          d={pathD}
          fill="none"
          stroke={isHighlighted ? 'var(--signal)' : 'rgba(21,137,93,0.3)'}
          strokeWidth={isHighlighted ? 2.5 : 1.5}
          strokeDasharray={isFeedback ? '6 4' : 'none'}
          markerEnd={isHighlighted ? 'url(#arrow-green)' : 'url(#arrow-gray)'}
        />,
      )
    }
    return arrows
  }

  return (
    <div className="axp-flow-container">
      <div className="axp-flow-header">
        <div className="axp-flow-archetype">
          <span className="axp-flow-archetype-icon">↻</span>
          循环飞轮
        </div>
        <div className="axp-flow-scope-tag">行业概览</div>
        <div className="axp-flow-stats">{slots.length} 个环节，{roles.length} 个代表岗位</div>
      </div>
      <p className="axp-flow-tagline">{flowMap.tagline[lang]}</p>

      <div className="axp-flow-canvas-wrap">
        {onBack && (
          <button className="axp-flow-back-btn" onClick={onBack}>← 返回行业全景</button>
        )}
        <div className="axp-flow-canvas" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform .2s' }}>
        <svg className="axp-flow-svg" viewBox="0 0 760 640">
          <defs>
            <marker id="arrow-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6" fill="rgba(21,137,93,0.3)" />
            </marker>
            <marker id="arrow-green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6" fill="var(--signal)" />
            </marker>
          </defs>

          {/* 中心圆 */}
          <circle cx={centerX} cy={centerY} r="70" fill="var(--bg)" stroke="var(--line)" strokeWidth="1" />
          <text x={centerX} y={centerY - 8} textAnchor="middle" className="axp-flow-center-title">核心成果</text>
          <text x={centerX} y={centerY + 12} textAnchor="middle" className="axp-flow-center-sub">用户与收入复利</text>

          {/* 环节圆点 */}
          {slots.map((slot: any, idx: number) => {
            const pos = getSlotPos(idx)
            const role = slotRoleMap[slot.id]
            const isSelected = role && selectedOldId === role.id
            return (
              <g key={slot.id}>
                <circle cx={pos.x} cy={pos.y} r="5" fill={isSelected ? 'var(--signal)' : 'rgba(21,137,93,0.4)'} />
                <text x={pos.labelX} y={pos.labelY} textAnchor="middle" className="axp-flow-slot-label">
                  {slot.label[lang]}
                </text>
              </g>
            )
          })}

          {/* 箭头连线 */}
          {renderArrows()}
        </svg>

        {/* 岗位按钮（HTML 绝对定位覆盖在 SVG 上） */}
        {slots.map((slot: any, idx: number) => {
          const role = slotRoleMap[slot.id]
          if (!role) return null
          const pos = getSlotPos(idx)
          const newId = oldToNew[role.id] ?? role.id
          const catRole = ALL_ROLES.find((r: any) => r.id === newId)
          const isSelected = selectedOldId === role.id
          const isEmerging = role.tier === 'emerging' || catRole?.emerging

          // 计算按钮对齐方式
          const angle = pos.angle
          let justify = 'center'
          if (angle > -30 && angle < 30) justify = 'flex-start'
          else if (angle > 150 || angle < -150) justify = 'flex-end'

          return (
            <button
              key={role.id}
              className={`axp-flow-role-btn ${isSelected ? 'is-selected' : ''} ${isEmerging ? 'is-emerging' : ''}`}
              style={{
                left: `${(pos.nodeX / 760) * 100}%`,
                top: `${(pos.nodeY / 640) * 100}%`,
                transform: `translate(-50%, -50%)`,
                justifyContent: justify,
              }}
              onClick={() => onSelectRole(newId)}
            >
              <PixelAvatar seed={newId} size={28} />
              <span className="axp-flow-role-name">{role.name[lang]}</span>
            </button>
          )
        })}

        {/* 缩放控制 */}
        <div className="axp-flow-zoom">
          <button className="axp-flow-zoom-btn" onClick={() => setZoom((z) => Math.min(z + 0.2, 2))}>+</button>
          <button className="axp-flow-zoom-btn" onClick={() => setZoom((z) => Math.max(z - 0.2, 0.5))}>−</button>
          <button className="axp-flow-zoom-btn" onClick={() => setZoom(1)} title="重置缩放">⤢</button>
        </div>
        </div>
      </div>

      {/* 图例 */}
      <div className="axp-flow-legend">
        <span><span className="axp-flow-legend-solid" /> 实线：有明确来源</span>
        <span><span className="axp-flow-legend-dashed" /> 虚线：基于参考框架推导</span>
        <span><span className="axp-flow-legend-width" /> 线宽：依据可信度分级</span>
        <span><span className="axp-flow-legend-emerging" /> 新兴岗位</span>
      </div>

      {/* 职业发展路径 */}
      {flowMap.mobility?.length > 0 && (
        <div className="axp-flow-mobility">
          <h3 className="axp-flow-mobility-h">职业发展路径</h3>
          <p className="axp-flow-mobility-note">以下展示常见的转岗与晋升方向，并与业务流程中的工作交接分别说明。</p>
          <div className="axp-flow-mobility-list">
            {flowMap.mobility.map((m: any, idx: number) => {
              const fromNew = oldToNew[m.from] ?? m.from
              const toNew = oldToNew[m.to] ?? m.to
              const fromRole = ALL_ROLES.find((r: any) => r.id === fromNew)
              const toRole = ALL_ROLES.find((r: any) => r.id === toNew)
              return (
                <button key={idx} className="axp-flow-mobility-item" onClick={() => onSelectRole(toNew)}>
                  <span className="axp-flow-mobility-from">{fromRole?.name[lang] ?? m.from}</span>
                  <span className="axp-flow-mobility-arrow">→</span>
                  <span className="axp-flow-mobility-to">{toRole?.name[lang] ?? m.to}</span>
                  <span className="axp-flow-mobility-note-inline">{m.note[lang]}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
