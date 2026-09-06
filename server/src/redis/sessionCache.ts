// 会话辅助缓存（D3 决策：会话以 PostgreSQL 为主，Redis 辅助加速校验）
// E 任务：requireAuth 先查 Redis，未命中回源 PG，并回填缓存
import { getRedis } from './client.js'
import { env } from '../config/env.js'

const PREFIX = 'sess:'

export function sessionKey(tokenHash: string): string {
  return `${PREFIX}${tokenHash}`
}

export async function cacheSession(tokenHash: string, userId: string, ttlSec: number): Promise<void> {
  const redis = getRedis()
  await redis.set(sessionKey(tokenHash), userId, 'EX', Math.max(ttlSec, 60))
}

export async function getCachedSession(tokenHash: string): Promise<string | null> {
  const redis = getRedis()
  return redis.get(sessionKey(tokenHash))
}

export async function deleteCachedSession(tokenHash: string): Promise<void> {
  const redis = getRedis()
  await redis.del(sessionKey(tokenHash))
}

/** 会话 TTL（秒），与 COOKIE 有效期一致 */
export function sessionTtlSec(): number {
  return env.SESSION_TTL_DAYS * 86400
}
