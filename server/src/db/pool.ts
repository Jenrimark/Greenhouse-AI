// PostgreSQL 连接池（业务数据主存储）
import pg from 'pg'
import { env } from '../config/env.js'

const { Pool } = pg

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
    })
    pool.on('error', (err) => {
      console.error('[pg] 连接池错误:', err.message)
    })
  }
  return pool
}

/** 健康检查：SELECT 1 验证连通性 */
export async function pingDb(): Promise<boolean> {
  try {
    await getPool().query('SELECT 1')
    return true
  } catch {
    return false
  }
}
