import { useMemo, useState } from 'react'
import { Search, X, Flame, Sparkles } from 'lucide-react'
import { useT, useI18n } from '../i18n/I18n'
import { Select } from '../components/Select'
import { PixelAvatar } from '../components/PixelAvatar'
import catalog from '../data/catalog.json'

const INDUSTRIES = (catalog as any).CATALOG_INDUSTRIES as any[]
const ALL_ROLES = (catalog as any).ALL_CAT_ROLES as any[]

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

function RoleCard({ role, showIndustry }: { role: any; showIndustry?: boolean }) {
  const { lang } = useI18n()
  return (
    <button className="axp-rc" type="button">
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
  const [industryId, setIndustryId] = useState('internet')
  const [track, setTrack] = useState('internet')
  const [view, setView] = useState<View>('catalog')
  const [q, setQ] = useState('')

  const industry = useMemo(() => INDUSTRIES.find((i) => i.id === industryId) ?? INDUSTRIES[0], [industryId])

  const trackOptions = useMemo(
    () => industry.flowTracks.map((f: any) => ({ value: f.id, label: f.label[lang] })),
    [industry, lang],
  )

  // 全局搜索：按名称 / 别称匹配
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
  }, [q, lang])

  return (
    <div className="page atlas">
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

        <Select
          value={industryId}
          onChange={setIndustryId}
          options={INDUSTRIES.map((i) => ({
            value: i.id,
            label: `${i.name[lang]} ${i.roles.length}`,
          }))}
        />
        <Select value={track} onChange={setTrack} options={trackOptions} />

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
              <RoleCard key={r.id} role={r} showIndustry />
            ))}
          </div>
        </section>
      ) : view === 'catalog' ? (
        <>
          <p className="axp-gistline">{industry.gist[lang]}</p>
          {industry.families.map((fam: any) => {
            const roles = industry.roles.filter((r: any) => r.familyId === fam.id)
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
                    <RoleCard key={r.id} role={r} />
                  ))}
                </div>
              </section>
            )
          })}
        </>
      ) : (
        <FlowView industry={industry} track={track} />
      )}
    </div>
  )
}

// 运转图：按职级阶梯展示（数据来自 ladders.json）
function FlowView({ industry, track }: { industry: any; track: string }) {
  const { lang } = useI18n()
  const roles = industry.roles.filter((r: any) => !track || industry.flowTracks.some((f: any) => f.id === track))
  const families = industry.families
  return (
    <div className="axp-ladder-wrap">
      {families.map((fam: any) => {
        const list = roles.filter((r: any) => r.familyId === fam.id).slice(0, 6)
        if (!list.length) return null
        return (
          <div className="axp-lane" key={fam.id}>
            <div className="axp-lane-h">
              <span className="axp-lvl-name">{fam.name[lang]}</span>
              <span className="axp-lane-desc faint">{fam.gist[lang]}</span>
            </div>
            <div className="axp-lvl-role-list">
              {list.map((r: any, i: number) => (
                <div className="axp-lvl-role" key={r.id}>
                  <span className="axp-step-n num">L{i + 1}</span>
                  <PixelAvatar seed={r.id} size={30} />
                  <span>{r.name[lang]}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
