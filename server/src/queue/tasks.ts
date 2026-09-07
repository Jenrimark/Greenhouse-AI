// A6 异步任务：agent_tasks 存储 + bullmq 队列封装
import { Queue } from 'bullmq'
import { randomUUID } from 'node:crypto'
import { getPool } from '../db/pool.js'
import { queueConnection, QUEUE_NAMES, type AgentTaskStatus } from './config.js'
import { ApiError } from '../middleware/error.js'
import { logger } from '../lib/logger.js'

export interface AgentTaskRow {
  id: string
  userId: string
  conversationId: string | null
  type: string
  status: AgentTaskStatus
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  error: string | null
  attempts: number
  createdAt: string
  updatedAt: string
  finishedAt: string | null
}

export const RESUME_TASK = 'resume_generate'

// ---------- 任务存储 ----------

export async function createTask(input: {
  userId: string
  conversationId?: string | null
  type: string
  payload: Record<string, unknown>
}): Promise<AgentTaskRow> {
  const pool = getPool()
  const id = randomUUID()
  await pool.query(
    `INSERT INTO agent_tasks (id, user_id, conversation_id, type, input, attempts)
     VALUES ($1, $2, $3, $4, $5, 0)`,
    [id, input.userId, input.conversationId ?? null, input.type, JSON.stringify(input.payload)],
  )
  return (await getTaskById(id))!
}

export async function getTaskById(id: string): Promise<AgentTaskRow | null> {
  const pool = getPool()
  const res = await pool.query(
    `SELECT id, user_id, conversation_id, type, status, input, output, error, attempts, created_at, updated_at, finished_at
     FROM agent_tasks WHERE id = $1`,
    [id],
  )
  const r = res.rows[0]
  if (!r) return null
  return {
    id: r.id,
    userId: r.user_id,
    conversationId: r.conversation_id,
    type: r.type,
    status: r.status,
    input: r.input,
    output: r.output,
    error: r.error,
    attempts: r.attempts,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
  }
}

/** 取任务并校验归属（越权 404） */
export async function getTaskForUser(userId: string, taskId: string): Promise<AgentTaskRow> {
  const task = await getTaskById(taskId)
  if (!task || task.userId !== userId) throw ApiError.notFound('任务不存在')
  return task
}

export async function updateTaskStatus(
  id: string,
  patch: Partial<{
    status: AgentTaskStatus
    output: Record<string, unknown> | null
    error: string | null
    attempts: number
    finishedAt: Date | null
  }>,
): Promise<void> {
  const pool = getPool()
  const sets: string[] = []
  const vals: unknown[] = []
  const push = (col: string, v: unknown) => {
    sets.push(`${col} = $${vals.length + 1}`)
    vals.push(v)
  }
  if (patch.status) push('status', patch.status)
  if ('output' in patch) push('output', patch.output ? JSON.stringify(patch.output) : null)
  if ('error' in patch) push('error', patch.error ?? null)
  if ('attempts' in patch) push('attempts', patch.attempts)
  if ('finishedAt' in patch) push('finished_at', patch.finishedAt)
  if (!sets.length) return
  vals.push(id)
  await pool.query(`UPDATE agent_tasks SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals)
}

// ---------- 队列 ----------

let agentQueue: Queue | null = null

export function getAgentQueue(): Queue {
  if (!agentQueue) {
    agentQueue = new Queue(QUEUE_NAMES.agentTasks, { connection: queueConnection() })
  }
  return agentQueue
}

export async function closeAgentQueue(): Promise<void> {
  if (agentQueue) {
    await agentQueue.close()
    agentQueue = null
  }
}

/** 投递简历生成任务（attempts=3 → 失败自动重试 2 次，指数退避） */
export async function enqueueResumeTask(input: {
  userId: string
  conversationId?: string | null
  targetRole: string
  jd?: string
}): Promise<AgentTaskRow> {
  const task = await createTask({
    userId: input.userId,
    conversationId: input.conversationId ?? null,
    type: RESUME_TASK,
    payload: { targetRole: input.targetRole, jd: input.jd ?? '' },
  })
  await getAgentQueue().add(RESUME_TASK, { taskId: task.id, userId: input.userId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  })
  logger.info({ taskId: task.id, type: RESUME_TASK }, '异步任务已入队')
  return task
}
