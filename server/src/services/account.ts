// 账号 service（F 任务；PIPL：账号注销与数据删除）
import { getPool } from '../db/pool.js'
import { ApiError } from '../middleware/error.js'
import { publicUser } from './auth.js'
import type { PublicUser } from '../types/index.js'

export async function getMe(userId: string): Promise<PublicUser> {
  const pool = getPool()
  const res = await pool.query(
    `SELECT id, email, name, handle, avatar_url, credits, created_at, updated_at
     FROM users WHERE id = $1 AND status = 'active'`,
    [userId],
  )
  if (res.rows.length === 0) throw ApiError.notFound('用户不存在')
  return publicUser(res.rows[0])
}

export interface UpdateMeInput {
  name?: string
  handle?: string
  email?: string
}

export async function updateMe(userId: string, input: UpdateMeInput): Promise<PublicUser> {
  const pool = getPool()
  const sets: string[] = []
  const params: unknown[] = []
  if (input.name !== undefined) {
    params.push(input.name)
    sets.push(`name = $${params.length}`)
  }
  if (input.handle !== undefined) {
    params.push(input.handle)
    sets.push(`handle = $${params.length}`)
  }
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase()
    const dup = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2', [email, userId])
    if (dup.rows.length > 0) throw ApiError.conflict('EMAIL_TAKEN', '该邮箱已被其他账号使用')
    params.push(email)
    sets.push(`email = $${params.length}`)
  }
  if (sets.length === 0) return getMe(userId)
  sets.push('updated_at = now()')
  params.push(userId)
  const res = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING id, email, name, handle, avatar_url, credits, created_at, updated_at`,
    params,
  )
  return publicUser(res.rows[0])
}

export async function getCredits(userId: string): Promise<number> {
  const pool = getPool()
  const res = await pool.query('SELECT credits FROM users WHERE id = $1', [userId])
  if (res.rows.length === 0) throw ApiError.notFound('用户不存在')
  return res.rows[0].credits as number
}

/**
 * 账号注销：物理删除用户（FK 级联删除会话/机会/经历/简历/流水/Agent 数据）。
 * PIPL 数据删除响应（首版物理删除，二期改软删除）。
 */
export async function deleteAccount(userId: string): Promise<void> {
  const pool = getPool()
  const res = await pool.query('DELETE FROM users WHERE id = $1', [userId])
  if (res.rowCount === 0) throw ApiError.notFound('用户不存在')
}
