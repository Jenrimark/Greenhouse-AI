// 鉴权中间件：attachUserIfPresent（可选挂载，全局）/ requireAuth（路由守卫）
import type { NextFunction, Request, Response } from 'express'
import { getSessionUser } from '../services/auth.js'
import { env } from '../config/env.js'

/** 读取 cookie 中的会话令牌并校验；有效则挂载 req.user，无效不拦截（供公开路由） */
export async function attachUserIfPresent(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[env.COOKIE_NAME] as string | undefined
    if (token) {
      req.user = (await getSessionUser(token)) ?? undefined
    }
    next()
  } catch (err) {
    console.error('[auth] attachUserIfPresent 异常:', (err as Error).message)
    next()
  }
}

/** 路由守卫：未登录返回 401 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '未登录或会话已过期' } })
    return
  }
  next()
}
