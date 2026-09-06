// 经历库路由（阶段 1 A 任务：演示版；F 任务按 user_id 隔离落 PostgreSQL）
import { Router } from 'express'
import { z } from 'zod'
import { db, save, id } from '../db.js'
import { ApiError } from '../middleware/error.js'
import { validateBody } from '../middleware/validate.js'

const router = Router()

router.get('/', (_req, res) => {
  const items = [...db().stories].sort((a, b) => (String(b.start || '')).localeCompare(String(a.start || '')))
  res.json({ items })
})

const createSchema = z.object({
  title: z.string().trim().min(1, '经历标题不能为空').max(200),
  org: z.string().max(200).optional().default(''),
  start: z.string().max(20).optional().default(''),
  end: z.string().max(20).optional().default(''),
  bullets: z.array(z.string().max(2000)).max(50).optional().default([]),
  tags: z.array(z.string().max(30)).max(20).optional().default([]),
})

router.post('/', validateBody(createSchema), (req, res) => {
  const { title, org, start, end, bullets, tags } = req.body
  const state = db()
  const entry = { id: id('story'), title, org, start, end, bullets, tags }
  state.stories.unshift(entry)
  save()
  res.status(201).json(entry)
})

router.delete('/:id', (req, res) => {
  const state = db()
  const before = state.stories.length
  state.stories = state.stories.filter((s) => s.id !== req.params.id)
  if (state.stories.length === before) throw ApiError.notFound('经历不存在')
  save()
  res.status(204).end()
})

export default router
