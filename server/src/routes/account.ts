// 账号路由（F：真实用户数据；PIPL 注销接口）
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateBody } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { deleteAccount, getCredits, getMe, updateMe } from '../services/account.js'
import { logoutSession } from '../services/auth.js'
import { env } from '../config/env.js'

const router = Router()
router.use(requireAuth)

router.get('/me', asyncHandler(async (req, res) => {
  res.json({ data: { user: await getMe(req.user!.id) } })
}))

const patchMeSchema = z.object({
  name: z.string().trim().min(1, '名称不能为空').max(50).optional(),
  handle: z.string().trim().min(1).max(30).optional(),
  email: z.string().trim().toLowerCase().email('邮箱格式不正确').max(254).optional(),
})

router.patch('/me', validateBody(patchMeSchema), asyncHandler(async (req, res) => {
  res.json({ data: { user: await updateMe(req.user!.id, req.body) } })
}))

router.get('/credits', asyncHandler(async (req, res) => {
  res.json({ data: { credits: await getCredits(req.user!.id) } })
}))

// 账号注销：删除账号与全部数据（PIPL）
router.delete('/me', asyncHandler(async (req, res) => {
  const token = req.cookies?.[env.COOKIE_NAME] as string | undefined
  await deleteAccount(req.user!.id)
  if (token) await logoutSession(token)
  res.clearCookie(env.COOKIE_NAME, { path: '/' })
  res.json({ data: { ok: true } })
}))

export default router
