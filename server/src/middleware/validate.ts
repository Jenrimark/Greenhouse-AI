// zod 请求校验中间件：POST/PATCH 请求体、GET query 统一过 schema
import type { Request, RequestHandler, Response } from 'express'
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

/** 解析后的 query 挂在 res.locals.query 上，用 validatedQuery 取回 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.query)
    if (!parsed.success) {
      next(ApiError.badRequest('VALIDATION_ERROR', '查询参数校验失败', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))))
      return
    }
    ;(res.locals as { query?: unknown }).query = parsed.data
    next()
  }
}

export function validatedQuery<T>(res: Response): T {
  return (res.locals.query ?? {}) as T
}

/** 路由参数（Express 4 泛型路由下取 id 等） */
export function param(req: Request, name: string): string {
  const v = req.params[name]
  if (!v) throw ApiError.badRequest('BAD_PARAM', `缺少路径参数 ${name}`)
  return v
}
