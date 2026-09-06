// 账号路由（阶段 1 A 任务：演示版；F 任务按 user_id 落 PostgreSQL）
import { Router } from 'express'
import { z } from 'zod'
import { db, save } from '../db.js'
import { validateBody } from '../middleware/validate.js'

const router = Router()

// 当前用户
router.get('/me', (req, res) => {
  res.json(db().user)
})

const patchMeSchema = z.object({
  name: z.string().trim().min(1, '名称不能为空').max(50).optional(),
  handle: z.string().trim().min(1).max(30).optional(),
  email: z.string().email().max(254).optional(),
})

router.patch('/me', validateBody(patchMeSchema), (req, res) => {
  const { name, handle, email } = req.body
  const user = db().user
  if (name !== undefined) user.name = name
  if (handle !== undefined) user.handle = handle
  if (email !== undefined) user.email = email
  save()
  res.json(user)
})

// Credits 余额
router.get('/credits', (req, res) => {
  res.json({ credits: db().credits })
})

export default router
