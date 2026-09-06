// 机会管线 service（F 任务抽取；A3 工具层复用。所有查询强制带 userId，杜绝水平越权）
import { getPool } from '../db/pool.js'
import { ApiError } from '../middleware/error.js'
import { id } from '../lib/id.js'

export interface OpportunityRow {
  id: string
  user_id: string
  company: string
  role: string
  jd: string | null
  location: string | null
  salary: string | null
  stage: string
  match: number | null
  next_action: Record<string, unknown> | null
  questions: unknown[] | null
  rounds: unknown[] | null
  due_at: Date | null
  sample: boolean
  created_at: Date
  updated_at: Date
}

export interface OpportunityInput {
  company: string
  role: string
  jd?: string
  location?: string
  salary?: string
}

export type OpportunityPatch = Partial<{
  stage: string
  location: string
  salary: string
  jd: string
  match: number | null
  nextAction: Record<string, unknown> | null
}>

const COLUMNS = 'id, user_id, company, role, jd, location, salary, stage, match, next_action, questions, rounds, due_at, sample, created_at, updated_at'

function toApi(row: OpportunityRow): Record<string, unknown> {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    jd: row.jd ?? '',
    location: row.location ?? '',
    salary: row.salary ?? '',
    stage: row.stage,
    match: row.match,
    nextAction: row.next_action,
    questions: row.questions ?? [],
    rounds: row.rounds ?? [],
    dueAt: row.due_at ? row.due_at.toISOString() : null,
    sample: row.sample,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

/** 根据岗位 + JD 生成预测面试题（规则版） */
function predictQuestions(role: string, jd: string): Array<{ id: string; text: string }> {
  const base = [
    `请做一个简短的自我介绍，并说明为什么应聘「${role}」这个岗位。`,
    `结合你的经历，讲一个最能体现你胜任「${role}」的项目，你具体负责什么、结果如何？`,
    '遇到需求紧急、资源不足或意见冲突时，你是如何推进并落地的？请举具体例子。',
    '你如何看待这个岗位未来一到两年的变化？你会如何补齐自己还不具备的能力？',
    '你有什么想问我们的？',
  ]
  if (jd && jd.length > 40) {
    base.splice(3, 0, '这份岗位描述中你认为最关键的三项要求是什么？你分别达到什么程度？')
  }
  return base.map((text, i) => ({ id: id('q'), text }))
}

export async function listOpportunities(userId: string, stage?: string): Promise<Record<string, unknown>[]> {
  const pool = getPool()
  const params: unknown[] = [userId]
  let sql = `SELECT ${COLUMNS} FROM opportunities WHERE user_id = $1`
  if (stage && stage !== 'all') {
    params.push(stage)
    sql += ` AND stage = $${params.length}`
  }
  sql += ' ORDER BY created_at DESC'
  const res = await pool.query(sql, params)
  return res.rows.map(toApi)
}

export async function getOpportunitySummary(userId: string): Promise<Record<string, unknown>> {
  const pool = getPool()
  const res = await pool.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE stage <> 'closed' AND next_action->>'due' IS NOT NULL)::int AS due,
            count(*) FILTER (WHERE stage = 'applied')::int AS applied,
            count(*) FILTER (WHERE stage = 'interview')::int AS interview,
            count(*) FILTER (WHERE stage = 'offer')::int AS offer,
            count(*) FILTER (WHERE stage = 'closed')::int AS closed
     FROM opportunities WHERE user_id = $1`,
    [userId],
  )
  const r = res.rows[0]
  return {
    total: r.total,
    due: r.due,
    byStage: { applied: r.applied, interview: r.interview, offer: r.offer, closed: r.closed },
  }
}

export async function getOpportunity(userId: string, opportunityId: string): Promise<Record<string, unknown>> {
  const pool = getPool()
  const res = await pool.query(`SELECT ${COLUMNS} FROM opportunities WHERE id = $1 AND user_id = $2`, [opportunityId, userId])
  if (res.rows.length === 0) throw ApiError.notFound('机会不存在')
  return toApi(res.rows[0])
}

export async function createOpportunity(userId: string, input: OpportunityInput): Promise<Record<string, unknown>> {
  const pool = getPool()
  const { company, role, jd = '', location = '', salary = '' } = input
  const match = jd ? 70 + Math.floor(Math.random() * 22) : null
  const res = await pool.query(
    `INSERT INTO opportunities (user_id, company, role, jd, location, salary, stage, match, next_action, questions, rounds)
     VALUES ($1, $2, $3, $4, $5, $6, 'applied', $7, $8, $9, '[]'::jsonb)
     RETURNING ${COLUMNS}`,
    [
      userId,
      company,
      role,
      jd,
      location,
      salary,
      match,
      JSON.stringify({ label: '完善职位描述', due: null }),
      JSON.stringify(predictQuestions(role, jd)),
    ],
  )
  return toApi(res.rows[0])
}

export async function updateOpportunity(userId: string, opportunityId: string, patch: OpportunityPatch): Promise<Record<string, unknown>> {
  const pool = getPool()
  const fieldMap: Record<string, string> = {
    stage: 'stage',
    location: 'location',
    salary: 'salary',
    jd: 'jd',
    match: 'match',
    nextAction: 'next_action',
  }
  const sets: string[] = []
  const params: unknown[] = []
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || !(key in fieldMap)) continue
    params.push(key === 'nextAction' ? JSON.stringify(value) : value)
    sets.push(`${fieldMap[key]} = $${params.length}`)
  }
  if (sets.length === 0) return getOpportunity(userId, opportunityId)
  sets.push("updated_at = now()")
  params.push(opportunityId, userId)
  const res = await pool.query(
    `UPDATE opportunities SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND user_id = $${params.length} RETURNING ${COLUMNS}`,
    params,
  )
  if (res.rows.length === 0) throw ApiError.notFound('机会不存在')
  return toApi(res.rows[0])
}

export async function deleteOpportunity(userId: string, opportunityId: string): Promise<void> {
  const pool = getPool()
  const res = await pool.query('DELETE FROM opportunities WHERE id = $1 AND user_id = $2', [opportunityId, userId])
  if (res.rowCount === 0) throw ApiError.notFound('机会不存在')
}
