// Redis 客户端（会话辅助 / 限流 / 异步队列，阶段 2 bullmq 复用同一连接配置）
import { Redis } from 'ioredis'
import { env } from '../config/env.js'

let client: Redis | null = null

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // bullmq 要求：队列连接不设重试上限
      lazyConnect: false,
    })
    client.on('error', (err) => {
      console.error('[redis] 连接错误:', err.message)
    })
  }
  return client
}

export async function pingRedis(): Promise<boolean> {
  try {
    const pong = await getRedis().ping()
    return pong === 'PONG'
  } catch {
    return false
  }
}

/** 优雅关闭（进程退出时调用） */
export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit()
    client = null
  }
}
