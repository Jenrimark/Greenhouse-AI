// 简历路由（F：简历模块落 PostgreSQL，user_id 隔离）
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/requireAuth.js'
import { param, validateBody } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { createResume, deleteResume, getResume, listResumes, updateResume } from '../services/resumes.js'

const router = Router()
router.use(requireAuth)

router.get('/', asyncHandler(async (req, res) => {
  res.json({ data: { items: await listResumes(req.user!.id) } })
}))

const createSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(200),
  templateId: z.string().max(50).optional().default('default'),
  content: z.record(z.unknown()).optional().default({}),
  fileUrl: z.string().max(500).nullable().optional(),
})

router.post('/', validateBody(createSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await createResume(req.user!.id, req.body) })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  res.json({ data: await getResume(req.user!.id, param(req, 'id')) })
}))

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.record(z.unknown()).optional(),
  fileUrl: z.string().max(500).nullable().optional(),
})

router.patch('/:id', validateBody(patchSchema), asyncHandler(async (req, res) => {
  res.json({ data: await updateResume(req.user!.id, param(req, 'id'), req.body) })
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  await deleteResume(req.user!.id, param(req, 'id'))
  res.status(204).end()
}))

export default router
