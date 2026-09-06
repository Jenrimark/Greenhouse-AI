// 简历 service（F 任务：简历模块落库；A3 工具层 read_resume / generate_resume 复用）
import { getPool } from '../db/pool.js'
import { ApiError } from '../middleware/error.js'

export interface ResumeRow {
  id: string
  user_id: string
  title: string
  template_id: string | null
  content: Record<string, unknown> | null
  file_url: string | null
  created_at: Date
  updated_at: Date
}

export interface ResumeInput {
  title: string
  templateId?: string
  content?: Record<string, unknown>
  fileUrl?: string | null
}

export function toResumeApi(row: ResumeRow): Record<string, unknown> {
  return {
    id: row.id,
    title: row.title,
    templateId: row.template_id,
    content: row.content ?? {},
    fileUrl: row.file_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export async function listResumes(userId: string): Promise<Record<string, unknown>[]> {
  const pool = getPool()
  const res = await pool.query(
    `SELECT id, user_id, title, template_id, content, file_url, created_at, updated_at
     FROM resumes WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId],
  )
  return res.rows.map(toResumeApi)
}

export async function getResume(userId: string, resumeId: string): Promise<Record<string, unknown>> {
  const pool = getPool()
  const res = await pool.query(
    `SELECT id, user_id, title, template_id, content, file_url, created_at, updated_at
     FROM resumes WHERE id = $1 AND user_id = $2`,
    [resumeId, userId],
  )
  if (res.rows.length === 0) throw ApiError.notFound('简历不存在')
  return toResumeApi(res.rows[0])
}

/** 当前用户最新一份简历（Agent read_resume 用；无则 null） */
export async function getLatestResume(userId: string): Promise<Record<string, unknown> | null> {
  const pool = getPool()
  const res = await pool.query(
    `SELECT id, user_id, title, template_id, content, file_url, created_at, updated_at
     FROM resumes WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [userId],
  )
  return res.rows.length > 0 ? toResumeApi(res.rows[0]) : null
}

export async function createResume(userId: string, input: ResumeInput): Promise<Record<string, unknown>> {
  const pool = getPool()
  const { title, templateId = 'default', content = {}, fileUrl = null } = input
  const res = await pool.query(
    `INSERT INTO resumes (user_id, title, template_id, content, file_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, title, template_id, content, file_url, created_at, updated_at`,
    [userId, title, templateId, JSON.stringify(content), fileUrl],
  )
  return toResumeApi(res.rows[0])
}

export async function updateResume(userId: string, resumeId: string, patch: Partial<{ title: string; content: Record<string, unknown>; fileUrl: string | null }>): Promise<Record<string, unknown>> {
  const pool = getPool()
  const sets: string[] = []
  const params: unknown[] = []
  if (patch.title !== undefined) {
    params.push(patch.title)
    sets.push(`title = $${params.length}`)
  }
  if (patch.content !== undefined) {
    params.push(JSON.stringify(patch.content))
    sets.push(`content = $${params.length}`)
  }
  if (patch.fileUrl !== undefined) {
    params.push(patch.fileUrl)
    sets.push(`file_url = $${params.length}`)
  }
  if (sets.length === 0) return getResume(userId, resumeId)
  sets.push('updated_at = now()')
  params.push(resumeId, userId)
  const res = await pool.query(
    `UPDATE resumes SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND user_id = $${params.length}
     RETURNING id, user_id, title, template_id, content, file_url, created_at, updated_at`,
    params,
  )
  if (res.rows.length === 0) throw ApiError.notFound('简历不存在')
  return toResumeApi(res.rows[0])
}

export async function deleteResume(userId: string, resumeId: string): Promise<void> {
  const pool = getPool()
  const res = await pool.query('DELETE FROM resumes WHERE id = $1 AND user_id = $2', [resumeId, userId])
  if (res.rowCount === 0) throw ApiError.notFound('简历不存在')
}
