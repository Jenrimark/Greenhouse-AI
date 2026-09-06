// 请求 ID 中间件：贯穿日志与错误响应
import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

export const requestId: RequestHandler = (req, res, next) => {
  const rid = (req.headers['x-request-id'] as string | undefined) || randomUUID()
  req.requestId = rid
  res.setHeader('x-request-id', rid)
  next()
}
