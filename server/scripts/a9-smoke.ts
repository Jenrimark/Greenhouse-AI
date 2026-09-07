// A9 验收：一次对话可在 agent_traces 复盘；credits 扣费与流水一致；余额不足 402
// 运行：npm run a9:smoke -w server（需要本地 PG + Redis）
import { registerUser } from '../src/services/auth.js'
import { deleteAccount } from '../src/services/account.js'
import { runAgentChat } from '../src/agent/runtime.js'
import { chargeCredits, creditsFromTokens } from '../src/services/credits.js'
import { getPool } from '../src/db/pool.js'
import { closeRedis } from '../src/redis/client.js'

const results: string[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const user = await registerUser({ email: `a9_${Date.now().toString(36)}@test.com`, password: 'a9pass12345' })
  const pool = getPool()

  // 1. 一次完整对话 → agent_traces 可复盘每一步
  const chat = await runAgentChat({ userId: user.id, message: '帮我制定求职策略，目标大厂后端' })
  const runId = chat.traceSummary.runId
  const traces = await pool.query(
    `SELECT node, status, duration_ms, run_id FROM agent_traces WHERE run_id = $1 ORDER BY created_at`,
    [runId],
  )
  check('对话后 agent_traces 有节点记录', traces.rows.length >= 2, `${traces.rows.length} 条`)
  check(
    '节点含意图路由与策略子图',
    traces.rows.some((r) => r.node.includes('intent')) && traces.rows.some((r) => r.node.includes('strategy')),
    traces.rows.map((r) => r.node).join(', '),
  )
  check('traces 状态均为 ok', traces.rows.every((r) => r.status === 'ok'))

  // 2. 扣费与 token 用量一致（直接造 LLM token 场景）
  const usage = { promptTokens: 3500, completionTokens: 2600 }
  const expect = creditsFromTokens(usage) // 3*1 + 2*2 = 7
  const before = (await pool.query(`SELECT credits FROM users WHERE id = $1`, [user.id])).rows[0].credits as number
  await chargeCredits({ userId: user.id, credits: expect, reason: 'agent_llm', refId: 'a9-test-run' })
  const after = (await pool.query(`SELECT credits FROM users WHERE id = $1`, [user.id])).rows[0].credits as number
  check('扣费数额与 token 折算一致', before - after === expect, `${before} → ${after}（扣 ${expect}）`)
  const tx = await pool.query(
    `SELECT amount, reason, ref_id FROM credits_tx WHERE user_id = $1 AND ref_id = 'a9-test-run'`,
    [user.id],
  )
  check('credits_tx 流水可审计', tx.rows.length === 1 && tx.rows[0].amount === -expect && tx.rows[0].reason === 'agent_llm')

  // 3. 余额不足 → 402 且不产生负余额
  const poor = await registerUser({ email: `a9p_${Date.now().toString(36)}@test.com`, password: 'a9pass12345' })
  await pool.query(`UPDATE users SET credits = 3 WHERE id = $1`, [poor.id])
  let denied = false
  try {
    await chargeCredits({ userId: poor.id, credits: 10, reason: 'agent_llm', refId: 'a9-poor' })
  } catch (e) {
    denied = (e as { status?: number }).status === 402
  }
  check('余额不足抛 402（paymentRequired）', denied, '')
  const poorBal = (await pool.query(`SELECT credits FROM users WHERE id = $1`, [poor.id])).rows[0].credits as number
  check('余额不足不产生负余额', poorBal === 3, `credits=${poorBal}`)

  // 清理
  await deleteAccount(user.id).catch(() => {})
  await deleteAccount(poor.id).catch(() => {})
  await pool.end()
  await closeRedis()

  console.log('\n=== A9 验收 ===')
  for (const line of results) console.log(line)
  const failed = results.filter((r) => r.startsWith('❌')).length
  if (failed > 0) process.exit(1)
  console.log(`\n通过 ${results.filter((r) => r.startsWith('✅')).length} 项，失败 ${failed} 项`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
