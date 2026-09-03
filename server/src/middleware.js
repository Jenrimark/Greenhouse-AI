// 会话中间件：本地环境不做真实鉴权，默认解析到演示用户；登录/游客接口写入会话 cookie
import { db } from './db.js'

export function attachUser(req, res, next) {
  const state = db()
  const token = req.cookies?.gr_session
  const session = state.sessions.find((s) => s.id === token)
  req.user = session ? state.user : state.user // 本地演示：始终回落到演示账号
  next()
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '未登录' })
  next()
}
