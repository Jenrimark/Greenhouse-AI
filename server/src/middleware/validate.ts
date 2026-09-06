// zod 请求校验中间件：POST/PATCH 请求体、GET query 统一过 schema
import type { RequestHandler } from 'express'
import type { z } from 'zod'
import { ApiError } from './error.js'

export function validateBody<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      next(ApiError.badRequest('VALIDATION_ERROR', '请求参数校验失败', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))))
      return
    }
    req.body = parsed.data
    next()
  }
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query)
    if (!parsed.success) {
      next(ApiError.badRequest('VALIDATION_ERROR', '查询参数校验失败', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))))
      return
    }
    req.query = parsed.data as never
    next()
  }
}
