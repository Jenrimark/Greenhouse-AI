// A9 计费：LLM token 用量 → credits 扣费（credits_tx 流水可审计）
import { getPool } from '../db/pool.js'
import { ApiError } from '../middleware/error.js'

// 费率（产品策略，可调）：每 1k 输入 token = 1 credit；每 1k 输出 token = 2 credits
export const CREDIT_RATES = { promptPer1k: 1, completionPer1k: 2 } as const

export interface TokenUsage {
  promptTokens?: number
  completionTokens?: number
}

/** 按 token 折算 credits（向下取整，无 token 数据按 0 处理） */
export function creditsFromTokens(u: TokenUsage): number {
  const p = Math.floor((u.promptTokens ?? 0) / 1000) * CREDIT_RATES.promptPer1k
  const c = Math.floor((u.completionTokens ?? 0) / 1000) * CREDIT_RATES.completionPer1k
  return p + c
}

/** 扣费并写流水（事务）；余额不足抛 402 */
export async function chargeCredits(opts: {
  userId: string
  credits: number
  reason: string
  refId?: string
}): Promise<void> {
  if (opts.credits <= 0) return
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const r = await client.query(
      `SELECT credits FROM users WHERE id = $1 FOR UPDATE`,
      [opts.userId],
    )
    const balance = r.rows[0]?.credits as number | undefined
    if (balance === undefined) throw ApiError.notFound('用户不存在')
    if (balance < opts.credits) {
      throw ApiError.paymentRequired(
        `Credits 不足（当前 ${balance}，需 ${opts.credits}），请充值后重试`,
      )
    }
    await client.query(
      `UPDATE users SET credits = credits - $2, updated_at = now() WHERE id = $1`,
      [opts.userId, opts.credits],
    )
    await client.query(
      `INSERT INTO credits_tx (user_id, amount, reason, ref_id) VALUES ($1, $2, $3, $4)`,
      [opts.userId, -opts.credits, opts.reason, opts.refId ?? null],
    )
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
