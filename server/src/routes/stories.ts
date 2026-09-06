// 经历库路由（F：user_id 隔离，业务逻辑在 service 层）
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/requireAuth.js'
import { param, validateBody } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { createStory, deleteStory, listStories } from '../services/stories.js'

const router = Router()
router.use(requireAuth)

router.get('/', asyncHandler(async (req, res) => {
  res.json({ data: { items: await listStories(req.user!.id) } })
}))

const createSchema = z.object({
  title: z.string().trim().min(1, '经历标题不能为空').max(200),
  org: z.string().max(200).optional().default(''),
  start: z.string().max(20).optional().default(''),
  end: z.string().max(20).optional().default(''),
  bullets: z.array(z.string().max(2000)).max(50).optional().default([]),
  tags: z.array(z.string().max(30)).max(20).optional().default([]),
})

router.post('/', validateBody(createSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await createStory(req.user!.id, req.body) })
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  await deleteStory(req.user!.id, param(req, 'id'))
  res.status(204).end()
}))

export default router
