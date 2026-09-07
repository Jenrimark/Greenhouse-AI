// A10.3 性能验收：20 并发会话稳定；单图执行 P95 < 5s（mock 模式）
// 运行：npm run a10:perf -w server（需要本地 PG + Redis）
import { registerUser } from '../src/services/auth.js'
import { deleteAccount } from '../src/services/account.js'
import { runAgentChat } from '../src/agent/runtime.js'
import { closeCheckpointer } from '../src/agent/checkpointer.js'
import { getPool } from '../src/db/pool.js'
import { closeRedis } from '../src/redis/client.js'

async function main() {
  const pool = getPool()
  const N = 20
  const users: string[] = []
  for (let i = 0; i < N; i++) {
    const u = await registerUser({ email: `perf_${i}_${Date.now().toString(36)}@test.com`, password: 'perfpass12345' })
    users.push(u.id)
  }
  const heapBefore = process.memoryUsage().heapUsed

  // 20 用户并发各跑 1 次完整对话（mock 图：意图路由 + 策略子图）
  const started = Date.now()
  const timings = await Promise.all(
    users.map(async (uid) => {
      const t0 = Date.now()
      await runAgentChat({ userId: uid, message: '帮我制定求职策略，目标大厂后端，3 年经验' })
      return Date.now() - t0
    }),
  )
  const totalMs = Date.now() - started
  timings.sort((a, b) => a - b)
  const p50 = timings[Math.floor(N * 0.5)]!
  const p95 = timings[Math.floor(N * 0.95)]!
  const max = timings[N - 1]!
  const avg = Math.round(timings.reduce((s, x) => s + x, 0) / N)

  const heapAfter = process.memoryUsage().heapUsed
  const heapDeltaMb = Math.round((heapAfter - heapBefore) / 1024 / 1024 * 100) / 100

  const results: string[] = []
  const check = (name: string, ok: boolean, detail = '') =>
    results.push(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
  check('P95 单图执行 < 5s', p95 < 5000, `P95=${p95}ms P50=${p50}ms avg=${avg}ms max=${max}ms`)
  check('20 并发全部完成', timings.length === N, `全部 ${timings.length} 次，总耗时 ${totalMs}ms`)
  check('内存无异常增长', heapDeltaMb < 50, `heap 增量 ${heapDeltaMb}MB`)

  await Promise.all(users.map((uid) => deleteAccount(uid).catch(() => {})))
  await closeCheckpointer()
  await pool.end()
  await closeRedis()

  console.log('\n=== A10.3 性能验收 ===')
  for (const line of results) console.log(line)
  if (results.some((r) => r.startsWith('❌'))) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
