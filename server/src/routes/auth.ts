// 认证路由：注册 / 登录 / 登出（真实会话，argon2id + 令牌落库）
import { Router } from 'express'
import { z } from 'zod'
import { loginUser, logoutSession, registerUser } from '../services/auth.js'
import { validateBody } from '../middleware/validate.js'
import { rateLimit } from '../redis/rateLimit.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { env } from '../config/env.js'

const router = Router()

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('邮箱格式不正确').max(254),
  password: z.string().min(8, '密码至少 8 位').max(128),
  name: z.string().trim().min(1).max(50).optional(),
})

// 注册：限流 10 次 / 15 分钟（IP）
router.post(
  '/register',
  rateLimit({ name: 'auth:register', limit: 10, windowSec: 900 }),
  validateBody(registerSchema),
  async (req, res, next) => {
    try {
      const user = await registerUser(req.body)
      res.status(201).json({ data: { user } })
    } catch (err) {
      next(err)
    }
  },
)

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('邮箱格式不正确').max(254),
  password: z.string().min(1).max(128),
})

// 登录：限流 20 次 / 15 分钟（IP）
router.post(
  '/login',
  rateLimit({ name: 'auth:login', limit: 20, windowSec: 900 }),
  validateBody(loginSchema),
  async (req, res, next) => {
    try {
      const xff = req.headers['x-forwarded-for']
      const ip = (typeof xff === 'string' ? xff.split(',')[0] : req.socket?.remoteAddress) ?? undefined
      const { user, token } = await loginUser(req.body, { ip, userAgent: req.headers['user-agent'] })
      res.cookie(env.COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.COOKIE_SECURE,
        maxAge: env.SESSION_TTL_DAYS * 864e5,
        path: '/',
      })
      res.json({ data: { user } })
    } catch (err) {
      next(err)
    }
  },
)

// 登出：吊销会话并清除 cookie
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const token = req.cookies?.[env.COOKIE_NAME] as string | undefined
    if (token) await logoutSession(token)
    res.clearCookie(env.COOKIE_NAME, { path: '/' })
    res.json({ data: { ok: true } })
  } catch (err) {
    next(err)
  }
})

export default router
