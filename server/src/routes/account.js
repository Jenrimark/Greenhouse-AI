import { Router } from 'express'
import { db, save } from '../db.js'

const router = Router()

// 当前用户
router.get('/me', (req, res) => {
  res.json(db().user)
})

router.patch('/me', (req, res) => {
  const { name, handle, email } = req.body || {}
  const user = db().user
  if (typeof name === 'string' && name.trim()) user.name = name.trim()
  if (typeof handle === 'string' && handle.trim()) user.handle = handle.trim()
  if (typeof email === 'string' && email.trim()) user.email = email.trim()
  save()
  res.json(user)
})

// Credits 余额
router.get('/credits', (req, res) => {
  res.json({ credits: db().credits })
})

export default router
