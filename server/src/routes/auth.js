import { Router } from 'express'
import { db, save, id } from '../db.js'

const router = Router()

// 登录（演示：任意邮箱 + 至少 12 位密码即通过，也可直接通过演示账号）
router.post('/login', (req, res) => {
  const { email } = req.body || {}
  const state = db()
  if (email) {
    state.user.email = String(email)
    const name = String(email).split('@')[0]
    if (name) state.user.name = name
  }
  const session = { id: id('sess'), userId: state.user.id }
  state.sessions.push(session)
  save()
  res.cookie('gr_session', session.id, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 864e5 })
  res.json({ ok: true, user: state.user })
})

// 游客免登录
router.post('/guest', (req, res) => {
  const state = db()
  const session = { id: id('sess'), userId: state.user.id }
  state.sessions.push(session)
  save()
  res.cookie('gr_session', session.id, { httpOnly: true, sameSite: 'lax' })
  res.json({ ok: true, user: state.user })
})

router.post('/logout', (req, res) => {
  res.clearCookie('gr_session')
  res.json({ ok: true })
})

export default router
