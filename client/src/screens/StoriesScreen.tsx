import { useEffect, useState } from 'react'
import { Plus, ArrowDownWideNarrow, FileSearch } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { EmptyState } from '../components/EmptyState'
import { api } from '../lib/api'
import type { StoryEntry } from '../lib/types'

export function StoriesScreen() {
  const t = useT()
  const [stories, setStories] = useState<StoryEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = () =>
    api
      .get<{ items: StoryEntry[] }>('/api/stories')
      .then((r) => setStories(r.items ?? []))
      .catch(() => setStories([]))
      .finally(() => setLoaded(true))

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="page stories">
      <div className="page-head">
        <div className="seg">
          <Select
            value="recent"
            onChange={() => {}}
            icon={<ArrowDownWideNarrow size={14} />}
            options={[{ value: 'recent', label: t('story_sort_recent') }]}
          />
        </div>
        <div className="page-tools">
          <Button variant="primary" icon={<Plus size={15} />}>
            {t('story_add')}
          </Button>
        </div>
      </div>

      {loaded && stories.length === 0 ? (
        <EmptyState
          artWebp="/art/empty-stories.webp"
          art="/art/empty-stories.png"
          title={t('story_empty_h')}
          sub={t('story_empty_sub')}
          action={
            <Button variant="primary" icon={<FileSearch size={15} />} onClick={() => navigateStudio()}>
              {t('story_from_resume')}
            </Button>
          }
        />
      ) : (
        <div className="story-list">
          {stories.map((s) => (
            <div className="story-card card" key={s.id}>
              <div className="story-card-h">
                <span className="story-card-title">{s.title}</span>
                {s.org && <span className="faint">{s.org}</span>}
              </div>
              {s.bullets?.map((b, i) => (
                <p className="story-bullet faint" key={i}>
                  {b}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function navigateStudio() {
  window.location.assign('/app/studio')
}
