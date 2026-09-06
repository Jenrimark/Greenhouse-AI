// 经历库 service（F 任务抽取；A3 工具层复用。所有查询强制带 userId）
import { getPool } from '../db/pool.js'
import { ApiError } from '../middleware/error.js'

export interface StoryRow {
  id: string
  user_id: string
  title: string
  org: string | null
  start: string | null
  end: string | null
  bullets: string[] | null
  tags: string[] | null
  created_at: Date
}

export interface StoryInput {
  title: string
  org?: string
  start?: string
  end?: string
  bullets?: string[]
  tags?: string[]
}

function toApi(row: StoryRow): Record<string, unknown> {
  return {
    id: row.id,
    title: row.title,
    org: row.org ?? '',
    start: row.start ?? '',
    end: row.end ?? '',
    bullets: row.bullets ?? [],
    tags: row.tags ?? [],
    createdAt: row.created_at.toISOString(),
  }
}

export async function listStories(userId: string): Promise<Record<string, unknown>[]> {
  const pool = getPool()
  const res = await pool.query(
    `SELECT id, user_id, title, org, start, "end", bullets, tags, created_at
     FROM stories WHERE user_id = $1 ORDER BY start DESC NULLS LAST, created_at DESC`,
    [userId],
  )
  return res.rows.map(toApi)
}

export async function createStory(userId: string, input: StoryInput): Promise<Record<string, unknown>> {
  const pool = getPool()
  const { title, org = '', start = '', end = '', bullets = [], tags = [] } = input
  const res = await pool.query(
    `INSERT INTO stories (user_id, title, org, start, "end", bullets, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, title, org, start, "end", bullets, tags, created_at`,
    [userId, title, org, start, end, JSON.stringify(bullets), tags],
  )
  return toApi(res.rows[0])
}

export async function deleteStory(userId: string, storyId: string): Promise<void> {
  const pool = getPool()
  const res = await pool.query('DELETE FROM stories WHERE id = $1 AND user_id = $2', [storyId, userId])
  if (res.rowCount === 0) throw ApiError.notFound('经历不存在')
}
