import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, SlidersHorizontal, Plus, Loader2, Briefcase } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { EmptyState } from '../components/EmptyState'
import { api } from '../lib/api'

interface JobItem {
  id: string
  role: string
  company: string
  location: string
  salary?: string
  exp?: string
  remote?: boolean
  tags?: string[]
  summary?: string
}

export function DiscoverScreen() {
  const t = useT()
  const navigate = useNavigate()
  const [kw, setKw] = useState('')
  const [city, setCity] = useState('any')
  const [years, setYears] = useState('any')
  const [salary, setSalary] = useState('any')
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [results, setResults] = useState<JobItem[]>([])

  const runSearch = async () => {
    setLoading(true)
    try {
      const r = await api.post<{ items: JobItem[] }>('/api/job-search', {
        keywords: kw,
        city,
        years,
        salary,
        remoteOnly,
      })
      setResults(r.items ?? [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  return (
    <div className="page discover">
      <section className="card disc-search-card">
        <div className="disc-kw-row">
          <label className="disc-kw-label">{t('disc_keywords')}</label>
          <div className="field disc-kw-field">
            <input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder={t('disc_kw_ph')}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            />
          </div>
          <Button variant="primary" icon={loading ? <Loader2 size={15} className="spin" /> : <Search size={15} />} onClick={runSearch}>
            {t('disc_run')}
          </Button>
        </div>
        <div className="disc-note-row">
          <span className="faint">{t('disc_no_resume_note')}</span>
          <button className="link-btn" onClick={() => navigate('/app/studio')}>
            {t('disc_paste_resume')}
          </button>
        </div>

        <div className="disc-filter-row">
          <Select
            value={city}
            onChange={setCity}
            icon={<MapPin size={14} />}
            options={[
              { value: 'any', label: t('disc_city_any') },
              { value: 'beijing', label: '北京' },
              { value: 'shanghai', label: '上海' },
              { value: 'shenzhen', label: '深圳' },
              { value: 'hangzhou', label: '杭州' },
              { value: 'wuhan', label: '武汉' },
              { value: 'remote', label: '远程' },
            ]}
          />
          <Select
            value={years}
            onChange={setYears}
            options={[
              { value: 'any', label: t('disc_years_any') },
              { value: '1', label: '1 年以内' },
              { value: '3', label: '1-3 年' },
              { value: '5', label: '3-5 年' },
              { value: '10', label: '5 年以上' },
            ]}
          />
          <Select
            value={salary}
            onChange={setSalary}
            options={[
              { value: 'any', label: t('disc_comp_any') },
              { value: '15', label: '15K 以上' },
              { value: '30', label: '30K 以上' },
              { value: '50', label: '50K 以上' },
            ]}
          />
          <label className="switch">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
            />
            <span className="track" />
            {t('disc_remote_only')}
          </label>
          <span className="grow" />
          <button className="link-btn disc-settings">
            <SlidersHorizontal size={14} /> {t('disc_search_settings')}
          </button>
        </div>
      </section>

      {!searched ? (
        <EmptyState
          artWebp="/art/empty-discover.webp"
          art="/art/empty-discover.png"
          title={t('disc_idle_h')}
          sub={t('disc_idle_sub')}
        />
      ) : results.length === 0 ? (
        <EmptyState title={t('disc_none_zh')} />
      ) : (
        <div className="disc-results rise-list">
          {results.map((job) => (
            <div className="job-card card" key={job.id}>
              <div className="job-card-main">
                <div className="job-card-h">
                  <span className="job-card-role">{job.role}</span>
                  <span className="job-card-salary">{job.salary}</span>
                </div>
                <div className="job-card-meta faint">
                  <Briefcase size={13} /> {job.company} · {job.location}
                  {job.exp ? ` · ${job.exp}` : ''}
                </div>
                {job.summary && <p className="job-card-sum faint">{job.summary}</p>}
                {job.tags && (
                  <div className="job-tags">
                    {job.tags.map((tag) => (
                      <span className="tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="secondary" size="sm" icon={<Plus size={13} />}>
                {t('disc_add')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
