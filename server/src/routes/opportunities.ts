// 机会管线路由（F：user_id 隔离，业务逻辑在 service 层）
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/requireAuth.js'
import { param, validatedQuery, validateBody, validateQuery } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import {
  createOpportunity,
  deleteOpportunity,
  getOpportunity,
  getOpportunitySummary,
  listOpportunities,
  updateOpportunity,
} from '../services/opportunities.js'

const router = Router()
router.use(requireAuth)

const listQuerySchema = z.object({ stage: z.string().max(30).optional() })

router.get('/', validateQuery(listQuerySchema), asyncHandler(async (req, res) => {
  const { stage } = validatedQuery<{ stage?: string }>(res)
  const items = await listOpportunities(req.user!.id, stage)
  res.json({ data: { items } })
}))

router.get('/summary', asyncHandler(async (req, res) => {
  res.json({ data: await getOpportunitySummary(req.user!.id) })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  res.json({ data: await getOpportunity(req.user!.id, param(req, 'id')) })
}))

const createSchema = z.object({
  company: z.string().trim().min(1, '公司不能为空').max(100),
  role: z.string().trim().min(1, '岗位不能为空').max(100),
  jd: z.string().max(20000).optional().default(''),
  location: z.string().max(100).optional().default(''),
  salary: z.string().max(100).optional().default(''),
})

router.post('/', validateBody(createSchema), asyncHandler(async (req, res) => {
  const item = await createOpportunity(req.user!.id, req.body)
  res.status(201).json({ data: item })
}))

const patchSchema = z.object({
  stage: z.string().max(30).optional(),
  location: z.string().max(100).optional(),
  salary: z.string().max(100).optional(),
  jd: z.string().max(20000).optional(),
  match: z.number().int().min(0).max(100).nullable().optional(),
  nextAction: z.record(z.unknown()).nullable().optional(),
})

router.patch('/:id', validateBody(patchSchema), asyncHandler(async (req, res) => {
  res.json({ data: await updateOpportunity(req.user!.id, param(req, 'id'), req.body) })
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  await deleteOpportunity(req.user!.id, param(req, 'id'))
  res.status(204).end()
}))

export default router
