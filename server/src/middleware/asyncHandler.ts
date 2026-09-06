// Express 4 异步路由处理器包装：catch 后交给统一错误中间件
import type { NextFunction, Request, RequestHandler, Response } from 'express'

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}
