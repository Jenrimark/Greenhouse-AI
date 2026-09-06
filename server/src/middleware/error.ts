// 统一错误中间件：所有错误收敛为 { error: { code, message } }
import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  static badRequest(code: string, message: string, details?: unknown) {
    return new ApiError(400, code, message, details)
  }
  static unauthorized(message = '未登录或会话已过期') {
    return new ApiError(401, 'UNAUTHORIZED', message)
  }
  static forbidden(message = '无权限执行此操作') {
    return new ApiError(403, 'FORBIDDEN', message)
  }
  static notFound(message = '资源不存在') {
    return new ApiError(404, 'NOT_FOUND', message)
  }
  static tooMany(message = '请求过于频繁，请稍后再试') {
    return new ApiError(429, 'RATE_LIMITED', message)
  }
  static conflict(code: string, message: string) {
    return new ApiError(409, code, message)
  }
}

/** 404 兜底（API 路径） */
export function apiNotFound(req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `接口不存在: ${req.path}` } })
}

/** 统一错误处理 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  // 请求 ID 贯穿日志
  const requestId = req.requestId ?? 'n/a'

  if (err instanceof ApiError) {
    if (err.status >= 500) console.error(`[${requestId}]`, err)
    res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) } })
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: '请求参数校验失败',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    })
    return
  }

  // 请求体 JSON 解析失败等
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: '请求体不是合法 JSON' } })
    return
  }

  console.error(`[${requestId}] 未捕获错误:`, err)
  res.status(500).json({ error: { code: 'INTERNAL', message: '服务器内部错误' } })
}
