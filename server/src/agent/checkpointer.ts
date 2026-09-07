// A4 记忆层：PostgresSaver checkpointer（会话 key = userId:conversationId）
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'
import { env } from '../config/env.js'

let saver: PostgresSaver | null = null

/** 获取全局 PostgresSaver（首次调用建表）；并发安全 */
export async function getCheckpointer(): Promise<PostgresSaver> {
  if (!saver) {
    saver = PostgresSaver.fromConnString(env.DATABASE_URL)
    await saver.setup() // 建 checkpoints / checkpoint_writes 表（幂等）
  }
  return saver
}

/** 会话 key：userId:conversationId（隔离用户与会话，互不串扰） */
export function threadIdFor(userId: string, conversationId: string): string {
  return `${userId}:${conversationId}`
}
