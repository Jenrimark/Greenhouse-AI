// 认证路由（阶段 1 A 任务：演示版，保持原行为；E 任务重写为邮箱密码 + 真实会话）
import { Router } from 'express'
import { z } from 'zod'
import { db, save, id } from '../db.js'
import { validateBody } from '../middleware/validate.js'

const router = Router()

const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确').max(254),
})

// 登录（演示）
router.post('/login', validateBody(loginSchema), (req, res) => {
  const { email } = req.body
  const state = db()
  state.user.email = email
  const name = email.split('@')[0]
  if (name) state.user.name = name
  const session = { id: id('sess'), userId: state.user.id }
  state.sessions.push(session)
  save()
  res.cookie('gr_session', session.id, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 864e5 })
  res.json({ ok: true, user: state.user })
})

// 游客免登录
router.post('/guest', (_req, res) => {
  const state = db()
  const session = { id: id('sess'), userId: state.user.id }
  state.sessions.push(session)
  save()
  res.cookie('gr_session', session.id, { httpOnly: true, sameSite: 'lax' })
  res.json({ ok: true, user: state.user })
})

router.post('/logout', (_req, res) => {
  res.clearCookie('gr_session')
  res.json({ ok: true })
})

export default router
