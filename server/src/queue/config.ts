// 异步队列配置预留（阶段 2 A6 bullmq 使用；D 任务先落位命名与连接约定）
import { env } from '../config/env.js'

export const QUEUE_NAMES = {
  /** Agent 异步节点（简历生成等耗时任务） */
  agentTasks: 'agent:tasks',
} as const

/**
 * bullmq 连接选项（阶段 2 初始化 Queue/Worker 时复用）。
 * maxRetriesPerRequest 必须为 null（bullmq 要求），见 redis/client.ts。
 */
export function queueConnection() {
  return { url: env.REDIS_URL, maxRetriesPerRequest: null }
}

/** 任务状态（A6 任务表/接口使用） */
export type AgentTaskStatus = 'pending' | 'running' | 'done' | 'failed'
