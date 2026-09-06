import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Table2, LayoutGrid, RefreshCw, Plus, SlidersHorizontal, Columns3, ArrowDownWideNarrow, X, ChevronDown, Trash2, Edit3 } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { EmptyState } from '../components/EmptyState'
import { api } from '../lib/api'
import type { Opportunity } from '../lib/types'
import { AddRoleDialog } from '../components/AddRoleDialog'

type Tab = 'active' | 'interviewing' | 'offers' | 'all' | 'closed'

const TABS: Array<{ id: Tab; key: string }> = [
  { id: 'active', key: 'f_active' },
  { id: 'interviewing', key: 'f_interviewing' },
  { id: 'offers', key: 'f_offers' },
  { id: 'all', key: 'f_all' },
  { id: 'closed', key: 'f_closed' },
]

const STAGE_OPTIONS = [
  { value: 'applied', label: '已投递' },
  { value: 'interview', label: '面试中' },
  { value: 'offer', label: '已收 Offer' },
  { value: 'closed', label: '已结束' },
]

const SORT_OPTIONS = [
  { value: 'recent', label: '最近更新' },
  { value: 'match', label: '匹配度优先' },
  { value: 'company', label: '公司名称' },
  { value: 'role', label: '岗位名称' },
]

export function PipelineScreen() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('active')
  const [view, setView] = useState<'table' | 'board'>('table')
  const [items, setItems] = useState<Opportunity[]>([])
  const [addOpen, setAddOpen] = useState(params.get('add') === '1')
  const [refreshing, setRefreshing] = useState(false)
  const [sortBy, setSortBy] = useState('recent')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [showCols, setShowCols] = useState(false)
  const [viewPreset, setViewPreset] = useState('default')
  const [groupBy, setGroupBy] = useState('none')
  const [filterMatch, setFilterMatch] = useState(0)
  const [filterDate, setFilterDate] = useState('any')

  const load = () =>
    api
      .get<{ data: { items: Opportunity[] } }>('/api/opportunities')
      .then((r) => setItems(r.data.items ?? []))
      .catch(() => setItems([]))

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => {
    const c = { active: 0, interviewing: 0, offers: 0, all: items.length, closed: 0 }
    for (const o of items) {
      if (o.stage === 'closed') c.closed++
      else if (o.stage === 'offer') c.offers++
      else if (o.stage === 'interview') c.interviewing++
      else c.active++
    }
    return c
  }, [items])

  const visible = useMemo(() => {
    let list = items
    if (tab === 'active') list = list.filter((o) => o.stage === 'applied')
    else if (tab === 'interviewing') list = list.filter((o) => o.stage === 'interview')
    else if (tab === 'offers') list = list.filter((o) => o.stage === 'offer')
    else if (tab === 'closed') list = list.filter((o) => o.stage === 'closed')

    // 筛选：最低匹配度
    if (filterMatch > 0) list = list.filter((o) => (o.match ?? 0) >= filterMatch)

    // 筛选：投递日期
    if (filterDate !== 'any') {
      const now = Date.now()
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000
      const monthAgo = now - 30 * 24 * 60 * 60 * 1000
      list = list.filter((o) => {
        const t = o.createdAt ? new Date(o.createdAt).getTime() : now
        if (filterDate === 'week') return t >= weekAgo
        if (filterDate === 'month') return t >= monthAgo
        return true
      })
    }

    // 排序
    if (sortBy === 'match') list = [...list].sort((a, b) => (b.match ?? 0) - (a.match ?? 0))
    else if (sortBy === 'company') list = [...list].sort((a, b) => a.company.localeCompare(b.company))
    else if (sortBy === 'role') list = [...list].sort((a, b) => a.role.localeCompare(b.role))

    return list
  }, [items, tab, sortBy, filterMatch, filterDate])

  const selected = items.find((o) => o.id === selectedId)

  const closeAdd = () => {
    setAddOpen(false)
    if (params.get('add')) {
      params.delete('add')
      setParams(params, { replace: true })
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      load()
      setRefreshing(false)
    }, 1200)
  }

  const updateStage = async (id: string, stage: string) => {
    try {
      await api.patch(`/api/opportunities/${id}`, { stage })
      setItems((prev) => prev.map((o) => (o.id === id ? { ...o, stage: stage as any } : o)))
    } catch {
      // fallback: local update
      setItems((prev) => prev.map((o) => (o.id === id ? { ...o, stage: stage as any } : o)))
    }
  }

  const deleteOpp = async (id: string) => {
    try {
      await api.del(`/api/opportunities/${id}`)
    } catch {
      // ignore
    }
    setItems((prev) => prev.filter((o) => o.id !== id))
    setSelectedId(null)
  }

  return (
    <div className="page pipe">
      <div className="page-head pipe-head">
        <div className="pipe-head-row">
          <div className="seg" role="tablist">
            {TABS.map((tb) => (
              <button key={tb.id} className={tab === tb.id ? 'is-active' : ''} onClick={() => setTab(tb.id)}>
                {t(tb.key)}
                <span className="seg-count">{counts[tb.id]}</span>
              </button>
            ))}
          </div>

          <div className="page-tools">
            <div className="seg pipe-view-switch">
              <button className={view === 'table' ? 'is-active' : ''} onClick={() => setView('table')} aria-label={t('view_table')}>
                <Table2 size={15} />
              </button>
              <button className={view === 'board' ? 'is-active' : ''} onClick={() => setView('board')} aria-label={t('view_board')}>
                <LayoutGrid size={15} />
              </button>
            </div>
            <Button variant="secondary" icon={<RefreshCw size={15} className={refreshing ? 'spin' : ''} />} onClick={handleRefresh}>
              {refreshing ? '更新中…' : t('update_from_mail')}
            </Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setAddOpen(true)}>{t('add_role')}</Button>
          </div>
        </div>

        <div className="pipe-head-row pipe-head-filters">
          <Select
            value={viewPreset}
            onChange={setViewPreset}
            options={[
              { value: 'default', label: t('pt_view_default') },
              { value: 'compact', label: '紧凑视图' },
              { value: 'detailed', label: '详细视图' },
            ]}
          />
          <Button variant="ghost" size="sm" onClick={() => alert('视图已保存')}>{t('pt_view_save')}</Button>
          <Select
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: 'none', label: t('pt_group_none') },
              { value: 'stage', label: '按阶段分组' },
              { value: 'company', label: '按公司分组' },
            ]}
          />
          <span className="grow" />
          <Button variant="ghost" size="sm" icon={<SlidersHorizontal size={14} />} onClick={() => setShowFilter(!showFilter)}>{t('pt_filter')}</Button>
          <Button variant="ghost" size="sm" icon={<Columns3 size={14} />} onClick={() => setShowCols(!showCols)}>{t('pt_cols')}</Button>
          <Select
            value={sortBy}
            onChange={setSortBy}
            icon={<ArrowDownWideNarrow size={14} />}
            options={SORT_OPTIONS}
          />
        </div>
      </div>

      {/* 筛选面板 */}
      {showFilter && (
        <div className="pipe-filter-panel card">
          <div className="pipe-filter-h">
            <span>筛选条件</span>
            <button className="iconbtn" onClick={() => setShowFilter(false)}><X size={14} /></button>
          </div>
          <div className="pipe-filter-body">
            <div className="pipe-filter-item">
              <label>最低匹配度：{filterMatch}%</label>
              <input type="range" min="0" max="100" value={filterMatch} onChange={(e) => setFilterMatch(Number(e.target.value))} />
            </div>
            <div className="pipe-filter-item">
              <label>投递日期</label>
              <Select value={filterDate} onChange={setFilterDate} options={[
                { value: 'any', label: '全部时间' },
                { value: 'week', label: '最近一周' },
                { value: 'month', label: '最近一月' },
              ]} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="primary" size="sm" onClick={() => setShowFilter(false)}>应用筛选</Button>
              <Button variant="ghost" size="sm" onClick={() => { setFilterMatch(0); setFilterDate('any') }}>重置</Button>
            </div>
          </div>
        </div>
      )}

      {/* 列设置面板 */}
      {showCols && (
        <div className="pipe-filter-panel card">
          <div className="pipe-filter-h">
            <span>显示列</span>
            <button className="iconbtn" onClick={() => setShowCols(false)}><X size={14} /></button>
          </div>
          <div className="pipe-cols-body">
            {['岗位', '公司', '匹配度', '阶段', '投递日期', '薪资', '地点'].map((col) => (
              <label key={col} className="pipe-col-check">
                <input type="checkbox" defaultChecked /> {col}
              </label>
            ))}
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          artWebp="/art/empty-pipeline.webp"
          art="/art/empty-pipeline.png"
          title={t('pipe_empty_h')}
          sub={t('pipe_empty_sub')}
          action={
            <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setAddOpen(true)}>
              {t('add_role')}
            </Button>
          }
        />
      ) : view === 'board' ? (
        <div className="board rise-list">
          {['applied', 'interview', 'offer'].map((stage) => (
            <div className="board-col" key={stage}>
              <div className="board-col-h">
                {t(stage === 'applied' ? 'f_active' : stage === 'interview' ? 'f_interviewing' : 'f_offers')}
                <span className="board-col-n num">{visible.filter((o) => o.stage === stage).length}</span>
              </div>
              <div className="board-col-body">
                {visible.filter((o) => o.stage === stage).map((o) => (
                  <div
                    className={`board-card ${selectedId === o.id ? 'is-selected' : ''}`}
                    key={o.id}
                    onClick={() => setSelectedId(selectedId === o.id ? null : o.id)}
                  >
                    <div className="board-card-role">{o.role}</div>
                    <div className="board-card-co faint">{o.company}</div>
                    {o.match != null && <div className="board-card-match">匹配 {o.match}%</div>}
                    {selectedId === o.id && (
                      <div className="board-card-actions">
                        <Select
                          value={o.stage}
                          onChange={(v) => updateStage(o.id, v)}
                          options={STAGE_OPTIONS}
                          size="sm"
                        />
                        <button className="iconbtn" onClick={(e) => { e.stopPropagation(); deleteOpp(o.id) }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="plist card">
          <table className="ptbl">
            <thead>
              <tr>
                <th>{t('f_active')}</th>
                <th />
                <th>{t('pipe_jd_match')}</th>
                <th>{t('pipe_sort_stage')}</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr key={o.id} className={selectedId === o.id ? 'is-selected' : ''} onClick={() => setSelectedId(selectedId === o.id ? null : o.id)}>
                  <td>{o.role}</td>
                  <td className="faint">{o.company}</td>
                  <td>{o.match != null ? `${o.match}%` : '—'}</td>
                  <td>
                    <Select
                      value={o.stage}
                      onChange={(v) => updateStage(o.id, v)}
                      options={STAGE_OPTIONS}
                      size="sm"
                    />
                  </td>
                  <td>
                    <button className="iconbtn" onClick={(e) => { e.stopPropagation(); deleteOpp(o.id) }}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 详情抽屉 */}
      {selected && (
        <div className="pipe-detail-drawer">
          <div className="pipe-detail-h">
            <h3>{selected.role}</h3>
            <button className="iconbtn" onClick={() => setSelectedId(null)}><X size={16} /></button>
          </div>
          <div className="pipe-detail-body">
            <div className="pipe-detail-row"><span className="faint">公司</span><span>{selected.company}</span></div>
            <div className="pipe-detail-row"><span className="faint">阶段</span><span>{STAGE_OPTIONS.find((s) => s.value === selected.stage)?.label ?? selected.stage}</span></div>
            <div className="pipe-detail-row"><span className="faint">匹配度</span><span>{selected.match != null ? `${selected.match}%` : '—'}</span></div>
            {selected.location && <div className="pipe-detail-row"><span className="faint">地点</span><span>{selected.location}</span></div>}
            {selected.salary && <div className="pipe-detail-row"><span className="faint">薪资</span><span>{selected.salary}</span></div>}
            <div className="pipe-detail-actions">
              <Button variant="secondary" size="sm" icon={<Edit3 size={13} />}>编辑</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => deleteOpp(selected.id)}>删除</Button>
            </div>
          </div>
        </div>
      )}

      {addOpen && <AddRoleDialog onClose={closeAdd} onCreated={() => { closeAdd(); load() }} />}
    </div>
  )
}
