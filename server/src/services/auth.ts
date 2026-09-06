// 认证 service：注册 / 登录 / 会话签发与校验（E 任务；A3 工具层可复用 getSessionUser）
import argon2 from 'argon2'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { getPool } from '../db/pool.js'
import { env } from '../config/env.js'
import { ApiError } from '../middleware/error.js'
import { cacheSession, deleteCachedSession, getCachedSession, sessionTtlSec } from '../redis/sessionCache.js'
import type { PublicUser } from '../types/index.js'

/** 新用户注册赠送额度 */
export const NEW_USER_CREDITS = 100

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export function publicUser(row: {
  id: string
  email: string
  name: string
  handle: string | null
  avatar_url: string | null
  credits: number
  created_at: Date
  updated_at: Date
}): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    handle: row.handle ?? '',
    avatar_url: row.avatar_url,
    credits: row.credits,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export interface RegisterInput {
  email: string
  password: string
  name?: string
}

export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase()
  const pool = getPool()

  const dup = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email])
  if (dup.rows.length > 0) throw ApiError.conflict('EMAIL_TAKEN', '该邮箱已注册，请直接登录')

  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const inserted = await client.query(
      `INSERT INTO users (email, password_hash, name, handle, credits, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, email, name, handle, avatar_url, credits, created_at, updated_at`,
      [email, passwordHash, input.name?.trim() || email.split('@')[0] || '用户', '', NEW_USER_CREDITS],
    )
    await client.query(
      `INSERT INTO credits_tx (user_id, amount, reason) VALUES ($1, $2, 'register-bonus')`,
      [inserted.rows[0].id, NEW_USER_CREDITS],
    )
    await client.query('COMMIT')
    return publicUser(inserted.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export interface SessionPayload {
  user: PublicUser
  token: string
}

/** 登录：校验密码 → 生成 32B 随机令牌 → sessions 落库（token_hash）→ 返回明文令牌 */
export async function loginUser(input: { email: string; password: string }, meta?: { ip?: string; userAgent?: string }): Promise<SessionPayload> {
  const email = input.email.trim().toLowerCase()
  const pool = getPool()
  const res = await pool.query(
    'SELECT id, email, password_hash, name, handle, avatar_url, credits, status, created_at, updated_at FROM users WHERE lower(email) = lower($1)',
    [email],
  )
  const row = res.rows[0]
  // 统一错误文案，避免邮箱枚举
  if (!row) throw ApiError.unauthorized('邮箱或密码不正确')
  if (row.status !== 'active') throw ApiError.forbidden('账号已被停用')

  const ok = await argon2.verify(row.password_hash as string, input.password)
  if (!ok) throw ApiError.unauthorized('邮箱或密码不正确')

  const token = randomBytes(32).toString('base64url')
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + sessionTtlSec() * 1000)

  await pool.query(
    `INSERT INTO sessions (id, user_id, token_hash, ip, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), row.id, tokenHash, meta?.ip ?? null, (meta?.userAgent ?? '').slice(0, 300) || null, expiresAt],
  )
  await cacheSession(tokenHash, row.id as string, sessionTtlSec())

  return { user: publicUser(row), token }
}

/** 校验令牌：Redis 优先，回源 PG，回填缓存；返回会话用户或 null */
export async function getSessionUser(token: string): Promise<PublicUser | null> {
  if (!token) return null
  const tokenHash = sha256(token)

  const cachedUserId = await getCachedSession(tokenHash)
  if (cachedUserId) {
    const row = await fetchUserById(cachedUserId)
    if (row) return row
  }

  const pool = getPool()
  const res = await pool.query(
    `SELECT u.id, u.email, u.name, u.handle, u.avatar_url, u.credits, u.created_at, u.updated_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active'`,
    [tokenHash],
  )
  const row = res.rows[0]
  if (!row) return null
  await cacheSession(tokenHash, row.id as string, sessionTtlSec())
  return publicUser(row)
}

async function fetchUserById(userId: string): Promise<PublicUser | null> {
  const pool = getPool()
  const res = await pool.query(
    `SELECT id, email, name, handle, avatar_url, credits, created_at, updated_at
     FROM users WHERE id = $1 AND status = 'active'`,
    [userId],
  )
  return res.rows[0] ? publicUser(res.rows[0]) : null
}

/** 登出：吊销会话（删 PG 行 + Redis 缓存） */
export async function logoutSession(token: string): Promise<void> {
  if (!token) return
  const tokenHash = sha256(token)
  const pool = getPool()
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash])
  await deleteCachedSession(tokenHash)
}

/** 定期清理过期会话（服务启动 + 每小时） */
export function startSessionCleanup(intervalMs = 3600_000): void {
  const clean = async () => {
    try {
      const res = await getPool().query('DELETE FROM sessions WHERE expires_at <= now()')
      if (res.rowCount && res.rowCount > 0) console.log(`[auth] 清理过期会话 ${res.rowCount} 条`)
    } catch (err) {
      console.error('[auth] 会话清理失败:', (err as Error).message)
    }
  }
  void clean()
  setInterval(clean, intervalMs)
}
