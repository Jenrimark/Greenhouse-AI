// 会话中间件（阶段 1 A 任务：保留演示行为；E 任务替换为真实会话校验 requireAuth）
import type { NextFunction, Request, Response } from 'express'
import { db } from '../db.js'

export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const state = db()
  const token = req.cookies?.gr_session as string | undefined
  // 本地演示：始终回落到演示账号
  void state.sessions.find((s) => s.id === token)
  req.user = {
    id: state.user.id,
    email: state.user.email,
    name: state.user.name,
    handle: state.user.handle,
    avatar_url: null,
    credits: state.credits,
    created_at: new Date(),
    updated_at: new Date(),
  }
  next()
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '未登录' } })
    return
  }
  next()
}
