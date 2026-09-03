import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Table2, LayoutGrid, RefreshCw, Plus, SlidersHorizontal, Columns3, ArrowDownWideNarrow } from 'lucide-react'
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

export function PipelineScreen() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('active')
  const [view, setView] = useState<'table' | 'board'>('table')
  const [items, setItems] = useState<Opportunity[]>([])
  const [addOpen, setAddOpen] = useState(params.get('add') === '1')

  const load = () =>
    api
      .get<{ items: Opportunity[] }>('/api/opportunities')
      .then((r) => setItems(r.items ?? []))
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
    if (tab === 'all') return items
    if (tab === 'active') return items.filter((o) => o.stage === 'applied')
    if (tab === 'interviewing') return items.filter((o) => o.stage === 'interview')
    if (tab === 'offers') return items.filter((o) => o.stage === 'offer')
    return items.filter((o) => o.stage === 'closed')
  }, [items, tab])

  const closeAdd = () => {
    setAddOpen(false)
    if (params.get('add')) {
      params.delete('add')
      setParams(params, { replace: true })
    }
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
            <Button variant="secondary" icon={<RefreshCw size={15} />}>{t('update_from_mail')}</Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setAddOpen(true)}>{t('add_role')}</Button>
          </div>
        </div>

        <div className="pipe-head-row pipe-head-filters">
          <Select value="default" onChange={() => {}} options={[{ value: 'default', label: t('pt_view_default') }]} />
          <Button variant="ghost" size="sm">{t('pt_view_save')}</Button>
          <Select value="none" onChange={() => {}} options={[{ value: 'none', label: t('pt_group_none') }]} />
          <span className="grow" />
          <Button variant="ghost" size="sm" icon={<SlidersHorizontal size={14} />}>{t('pt_filter')}</Button>
          <Button variant="ghost" size="sm" icon={<Columns3 size={14} />}>{t('pt_cols')}</Button>
          <Button variant="ghost" size="sm" icon={<ArrowDownWideNarrow size={14} />}>{t('pipe_sort_fit')}</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          artWebp="/art/empty-pipeline.webp"
          art="/art/empty-pipeline.png"
          title={t('pipe_empty_h')}
          sub={t('pipe_empty_sub')}
          action={
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setAddOpen(true)}>
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
                  <div className="board-card" key={o.id}>
                    <div className="board-card-role">{o.role}</div>
                    <div className="board-card-co faint">{o.company}</div>
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
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr key={o.id}>
                  <td>{o.role}</td>
                  <td className="faint">{o.company}</td>
                  <td>{o.match ?? '—'}</td>
                  <td>{o.stage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && <AddRoleDialog onClose={closeAdd} onCreated={() => { closeAdd(); load() }} />}
    </div>
  )
}
