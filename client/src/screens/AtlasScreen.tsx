import { useEffect, useMemo, useState } from 'react'
import { Search, X, Flame, Sparkles, Layers } from 'lucide-react'
import { useT, useI18n } from '../i18n/I18n'
import { GridSelect, INDUSTRY_ICONS } from '../components/GridSelect'
import { PixelAvatar } from '../components/PixelAvatar'
import { FlowMapView } from '../components/FlowMapView'
import { IntelPanel } from '../components/IntelPanel'
import { useLazyData } from '../lib/lazyData'
import { getIndustryById, resolveFlowMapId } from '../lib/atlasData'

type View = 'catalog' | 'flow'

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

function RoleCard({ role, showIndustry, onSelect }: { role: any; showIndustry?: boolean; onSelect: (id: string) => void }) {
  const { lang } = useI18n()
  return (
    <button className="axp-rc" type="button" onClick={() => onSelect(role.id)}>
      <span className="axp-rc-av">
        <PixelAvatar seed={role.id} size={38} />
      </span>
      <span className="axp-rc-main">
        <span className="axp-rc-l1">
          <span className="axp-rc-name">{role.name[lang]}</span>
          <RoleMarks role={role} />
        </span>
        <span className="axp-rc-gist">
          {showIndustry && <span className="axp-rc-ind">{role.industryName[lang]} · </span>}
          {role.gist[lang]}
        </span>
      </span>
    </button>
  )
}

export function AtlasScreen() {
  const t = useT()
  const { lang } = useI18n()
  const { data: ds, ready, error, retry } = useLazyData(['catalog'])
  const [industryId, setIndustryId] = useState('internet')
  const [track, setTrack] = useState('internet')
  const [view, setView] = useState<View>('catalog')
  const [q, setQ] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)

  const catalog = ds.catalog as any
  const INDUSTRIES = ready ? (catalog?.CATALOG_INDUSTRIES as any[]) ?? [] : []
  const ALL_ROLES = ready ? (catalog?.ALL_CAT_ROLES as any[]) ?? [] : []


  const industry = useMemo(() => getIndustryById(INDUSTRIES, industryId), [INDUSTRIES, industryId])
  const flowTracks = (industry?.flowTracks as any[] | undefined) ?? []
  const trackOptions = useMemo(
    () => flowTracks.map((f: any) => ({ value: f.id, label: f.label?.[lang] ?? f.id })),
    [flowTracks, lang],
  )
  const selectedTrack = useMemo(
    () => flowTracks.find((f: any) => f.id === track),
    [flowTracks, track],
  )
  const mapId = selectedTrack?.mapId ?? resolveFlowMapId(industry)

  const searchResults = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (!kw) return []
    return ALL_ROLES.filter((r) => {
      return (
        r.name[lang].toLowerCase().includes(kw) ||
        r.name.en.toLowerCase().includes(kw) ||
        (r.aliases || []).some((a: string) => a.toLowerCase().includes(kw))
      )
    }).slice(0, 60)
  }, [ALL_ROLES, q, lang])

  useEffect(() => {
    const firstTrack = flowTracks[0]
    setTrack(firstTrack?.id ?? industry?.mapId ?? industry?.id ?? '')
  }, [industry, flowTracks])

  const handleSelectRole = (id: string) => {
    setSelectedRoleId(id)
  }

  if (error) {
    return (
      <div className="page atlas">
        <div className="axp-main axp-loading">
          <p>岗位地图数据加载失败，请重试。</p>
          <button className="btn btn-secondary" type="button" onClick={retry}>重试</button>
        </div>
      </div>
    )
  }

  if (!ready || !industry) {
    return (
      <div className="page atlas">
        <div className="axp-main axp-loading">数据加载中…</div>
      </div>
    )
  }

  return (
    <div className={`page atlas ${selectedRoleId ? 'has-intel' : ''}`}>
      <div className="axp-main">
        <div className="axp-topbar">
          <div className="field axp-search">
            <Search size={16} />
            <input
              value={q}
              placeholder={t('axp_search_placeholder')}
              onChange={(e) => setQ(e.target.value)}
              aria-label={t('axp_search_label')}
            />
            {q && (
              <button className="axp-search-clear iconbtn" onClick={() => setQ('')} aria-label={t('clear')}>
                <X size={14} />
              </button>
            )}
          </div>

          <GridSelect
            value={industryId}
            onChange={setIndustryId}
            icon={INDUSTRY_ICONS[industryId]}
            options={INDUSTRIES.map((i) => ({
              value: i.id,
              label: i.name[lang],
              count: i.roles.length,
              icon: INDUSTRY_ICONS[i.id],
            }))}
          />
          {trackOptions.length > 0 && (
            <GridSelect
              value={selectedTrack?.id ?? trackOptions[0].value}
              onChange={setTrack}
              icon={<Layers size={15} />}
              options={trackOptions.map((o) => ({ value: o.value, label: o.label }))}
            />
          )}

          <span className="grow" />
          <div className="seg axp-viewtoggle">
            <button className={view === 'catalog' ? 'is-active' : ''} onClick={() => setView('catalog')}>
              {t('axp_seg_catalog')}
            </button>
            <button className={view === 'flow' ? 'is-active' : ''} onClick={() => setView('flow')}>
              {t('axp_seg_flow')}
            </button>
          </div>
        </div>

        {q.trim() ? (
          <section className="axp-fam">
            <div className="axp-fam-h">
              <span className="axp-fam-n">
                {t('axp_search_label')} · {searchResults.length}
              </span>
            </div>
            <div className="axp-rolegrid">
              {searchResults.map((r) => (
                <RoleCard key={r.id} role={r} showIndustry onSelect={handleSelectRole} />
              ))}
            </div>
          </section>
        ) : view === 'catalog' ? (
          <>
            <p className="axp-gistline">{industry.gist[lang]}</p>
            {(industry.families as any[] ?? []).map((fam: any) => {
              const roles = (industry.roles as any[] ?? []).filter((r: any) => r.familyId === fam.id)
              if (!roles.length) return null
              return (
                <section className="axp-fam" key={fam.id}>
                  <div className="axp-fam-h">
                    <span className="axp-fam-n">{fam.name[lang]}</span>
                    <span className="axp-fam-g">{fam.gist[lang]}</span>
                    {fam.group && <span className="axp-fam-grp">{fam.group[lang]}</span>}
                  </div>
                  <div className="axp-rolegrid">
                    {roles.map((r: any) => (
                      <RoleCard key={r.id} role={r} onSelect={handleSelectRole} />
                    ))}
                  </div>
                </section>
              )
            })}
          </>
        ) : (
          <FlowMapView
            industryId={industryId}
            mapId={mapId}
            selectedRoleId={selectedRoleId}
            onSelectRole={handleSelectRole}
            onBack={() => setView('catalog')}
          />
        )}
      </div>

      {selectedRoleId && (
        <IntelPanel
          roleId={selectedRoleId}
          industryId={industryId}
          mapId={mapId ?? industryId}
          onSelectRole={handleSelectRole}
          onClose={() => setSelectedRoleId(null)}
        />
      )}
    </div>
  )
}
