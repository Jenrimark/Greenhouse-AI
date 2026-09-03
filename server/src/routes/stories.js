import { Router } from 'express'
import { db, save, id } from '../db.js'

const router = Router()

router.get('/', (req, res) => {
  const items = [...db().stories].sort((a, b) => (b.start || '').localeCompare(a.start || ''))
  res.json({ items })
})

router.post('/', (req, res) => {
  const { title, org, start, end, bullets, tags } = req.body || {}
  if (!title?.trim()) return res.status(400).json({ error: '经历标题不能为空' })
  const state = db()
  const entry = {
    id: id('story'),
    title: title.trim(),
    org: org || '',
    start: start || '',
    end: end || '',
    bullets: Array.isArray(bullets) ? bullets : [],
    tags: Array.isArray(tags) ? tags : [],
  }
  state.stories.unshift(entry)
  save()
  res.status(201).json(entry)
})

router.delete('/:id', (req, res) => {
  const state = db()
  state.stories = state.stories.filter((s) => s.id !== req.params.id)
  save()
  res.status(204).end()
})

export default router
