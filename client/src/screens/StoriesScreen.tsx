import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowDownWideNarrow, Sparkles, Edit3, Trash2, X, Check } from 'lucide-react'
import { useT } from '../i18n/I18n'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { EmptyState } from '../components/EmptyState'
import { api } from '../lib/api'
import { storyPayload, unwrapStories } from '../lib/stories'
import type { StoryEntry } from '../lib/types'

const SORT_OPTIONS = [
  { value: 'recent', label: '最近更新' },
  { value: 'title', label: '按标题' },
  { value: 'org', label: '按公司/组织' },
]

export function StoriesScreen() {
  const t = useT()
  const navigate = useNavigate()
  const [stories, setStories] = useState<StoryEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [sortBy, setSortBy] = useState('recent')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBullets, setEditBullets] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newOrg, setNewOrg] = useState('')
  const [newBullets, setNewBullets] = useState('')

  const load = () =>
    api
      .get<{ data: { items: StoryEntry[] } }>('/api/stories')
      .then((r) => setStories(unwrapStories(r)))
      .catch(() => setStories([]))
      .finally(() => setLoaded(true))

  useEffect(() => {
    load()
  }, [])

  const sorted = useMemo(() => {
    let list = [...stories]
    if (sortBy === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
    else if (sortBy === 'org') list.sort((a, b) => (a.org ?? '').localeCompare(b.org ?? ''))
    return list
  }, [stories, sortBy])

  const handleAdd = async () => {
    const payload = storyPayload(newTitle, newOrg, newBullets)
    if (!payload.title) return
    try {
      const response = await api.post<{ data: StoryEntry }>('/api/stories', payload)
      setStories((prev) => [response.data, ...prev])
      setNewTitle('')
      setNewOrg('')
      setNewBullets('')
      setShowAdd(false)
    } catch {
      // Keep the form open so the user can retry.
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.del(`/api/stories/${id}`)
      setStories((prev) => prev.filter((s) => s.id !== id))
    } catch {
      // Keep the story visible when deletion fails.
    }
  }

  return (
    <div className="page stories">
      <div className="page-head">
        <div className="seg">
          <Select
            value={sortBy}
            onChange={setSortBy}
            icon={<ArrowDownWideNarrow size={14} />}
            options={SORT_OPTIONS}
          />
        </div>
        <div className="page-tools">
          <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setShowAdd(!showAdd)}>
            {t('story_add')}
          </Button>
        </div>
      </div>

      {/* 新增经历表单 */}
      {showAdd && (
        <div className="story-add-card card">
          <div className="story-add-h">
            <span>新增经历</span>
            <button className="iconbtn" onClick={() => setShowAdd(false)}><X size={14} /></button>
          </div>
          <div className="story-add-body">
            <div className="field">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="经历标题（如：主导用户增长项目）"
              />
            </div>
            <div className="field">
              <input
                value={newOrg}
                onChange={(e) => setNewOrg(e.target.value)}
                placeholder="公司/组织（可选）"
              />
            </div>
            <div className="field">
              <textarea
                value={newBullets}
                onChange={(e) => setNewBullets(e.target.value)}
                placeholder="描述要点，每行一条"
                rows={3}
              />
            </div>
            <Button variant="primary" icon={<Check size={14} />} onClick={handleAdd}>保存经历</Button>
          </div>
        </div>
      )}

      {loaded && stories.length === 0 ? (
        <EmptyState
          artWebp="/art/empty-stories.webp"
          art="/art/empty-stories.png"
          title={t('story_empty_h')}
          sub={t('story_empty_sub')}
          action={
            <Button variant="primary" icon={<Sparkles size={15} />} onClick={() => navigate('/app/studio')}>
              {t('story_from_resume')}
            </Button>
          }
        />
      ) : (
        <div className="story-list">
          {sorted.map((s) => (
            <div className={`story-card card ${editingId === s.id ? 'is-editing' : ''}`} key={s.id}>
              <div className="story-card-h">
                <div>
                  <span className="story-card-title">{s.title}</span>
                  {s.org && <span className="faint"> · {s.org}</span>}
                </div>
                <div className="story-card-actions">
                  <button
                    className="iconbtn"
                    onClick={() => {
                      setEditingId(editingId === s.id ? null : s.id)
                      setEditBullets(s.bullets?.join('\n') ?? '')
                    }}
                  >
                    <Edit3 size={13} />
                  </button>
                  <button className="iconbtn" onClick={() => handleDelete(s.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {editingId === s.id ? (
                <div className="story-edit">
                  <textarea
                    className="story-edit-textarea"
                    value={editBullets}
                    onChange={(e) => setEditBullets(e.target.value)}
                    rows={4}
                  />
                  <div className="story-edit-actions">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={async () => {
                        try {
                          const response = await api.patch<{ data: StoryEntry }>(`/api/stories/${s.id}`, {
                            bullets: editBullets.split('\n').filter((bullet) => bullet.trim()),
                          })
                          setStories((prev) => prev.map((story) => story.id === s.id ? response.data : story))
                          setEditingId(null)
                        } catch {
                          // Keep editing state so the user can retry.
                        }
                      }}
                    >保存</Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>取消</Button>
                  </div>
                </div>
              ) : (
                s.bullets?.map((b, i) => (
                  <p className="story-bullet faint" key={i}>
                    {b}
                  </p>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
