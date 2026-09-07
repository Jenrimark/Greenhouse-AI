// 岗位检索路由（演示数据；A3 起复用 service，响应统一 {data:{items,total}}）
import { Router } from 'express'
import { z } from 'zod'
import { validateBody } from '../middleware/validate.js'
import { searchJobs } from '../services/jobSearch.js'

const router = Router()

const searchSchema = z.object({
  keywords: z.string().max(100).optional().default(''),
  city: z.string().max(20).optional().default('any'),
  years: z.coerce.number().int().min(0).max(50).optional(),
  salary: z.coerce.number().int().min(0).optional(),
  remoteOnly: z.coerce.boolean().optional().default(false),
})

// 公开岗位检索（无需登录）
router.post('/', validateBody(searchSchema), (req, res) => {
  const { keywords, city, years, salary, remoteOnly } = req.body
  const { items, total } = searchJobs({ keywords, city, years, salary, remoteOnly })
  setTimeout(() => res.json({ data: { items, total } }), 260)
})

export default router
