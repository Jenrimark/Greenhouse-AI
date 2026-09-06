// 限流：Redis 固定窗口计数器（INCR + EXPIRE），供登录 / 注册 / AI 接口重点使用
import type { RequestHandler } from 'express'
import { ApiError } from '../middleware/error.js'
import { getRedis } from './client.js'

export interface RateLimitOptions {
  /** 限流键前缀（区分接口，如 auth:login / ai:chat） */
  name: string
  /** 窗口内最大次数 */
  limit: number
  /** 窗口秒数 */
  windowSec: number
  /** 是否按 IP 维度（默认 true）；为 false 时需传入 key 构造器 */
  byIp?: boolean
}

function clientIp(req: import('express').Request): string {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0]!.trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

/** 固定窗口限流中间件；超限返回 429 { error: { code: 'RATE_LIMITED' } } */
export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const { name, limit, windowSec, byIp = true } = opts
  return async (req, _res, next) => {
    try {
      const bucket = byIp ? `${name}:${clientIp(req)}` : `${name}:${req.user?.id ?? 'anon'}`
      const redis = getRedis()
      const count = await redis.incr(bucket)
      if (count === 1) await redis.expire(bucket, windowSec)
      if (count > limit) {
        const ttl = await redis.ttl(bucket)
        next(ApiError.tooMany(`请求过于频繁，请 ${Math.max(ttl, 1)} 秒后重试`))
        return
      }
      next()
    } catch (err) {
      // 限流依赖 Redis 失败时放行（可用性优先），记录日志
      console.error('[rateLimit] Redis 异常，本次放行:', (err as Error).message)
      next()
    }
  }
}

/** 基于 user_id 的限流（如每用户 AI 请求数） */
export function rateLimitByUser(opts: Omit<RateLimitOptions, 'byIp'>): RequestHandler {
  return rateLimit({ ...opts, byIp: false })
}
