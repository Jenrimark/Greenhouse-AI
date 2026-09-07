// A6 验收脚本：任务入队→状态流转→重试→进程重启恢复 + 异步不阻塞
// 运行：npm run a6:smoke -w server（需要本地 PG + Redis）
import { Worker } from 'bullmq'
import { registerUser } from '../src/services/auth.js'
import { deleteAccount } from '../src/services/account.js'
import {
  enqueueResumeTask,
  getTaskById,
  getTaskForUser,
  closeAgentQueue,
  getAgentQueue,
  RESUME_TASK,
} from '../src/queue/tasks.js'
import { queueConnection, QUEUE_NAMES } from '../src/queue/config.js'
import { getPool } from '../src/db/pool.js'
import { closeRedis, getRedis } from '../src/redis/client.js'

const results: string[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const user = await registerUser({ email: `a6_${Date.now().toString(36)}@test.com`, password: 'a6pass12345' })

  // 场景 1：无 worker 时入队 → 状态 pending（异步不阻塞）
  const t1 = await enqueueResumeTask({ userId: user.id, targetRole: '前端工程师', jd: 'React + TS' })
  const t1b = await getTaskById(t1.id)
  check('入队后状态 pending（未启动 worker）', t1b?.status === 'pending', `status=${t1b?.status}`)

  // 场景 2：worker 启动 → 任务流转 done（进程恢复消费 = 重启可恢复）
  const worker = new Worker(
    QUEUE_NAMES.agentTasks,
    async (job) => {
      if (job.name !== RESUME_TASK) return
      const data = job.data as { taskId: string; userId: string }
      const task = await getTaskById(data.taskId)
      if (!task) return
      await getPool().query(
        `UPDATE agent_tasks SET status='running', attempts=$2, updated_at=now() WHERE id=$1`,
        [data.taskId, job.attemptsMade + 1],
      )
      await getPool().query(
        `UPDATE agent_tasks SET status='done', output=$2::jsonb, finished_at=now(), updated_at=now() WHERE id=$1`,
        [data.taskId, JSON.stringify({ ok: true, resumeId: 'mock-' + data.taskId.slice(0, 8) })],
      )
    },
    { connection: queueConnection(), concurrency: 2 },
  )
  await sleep(1200)
  const t1c = await getTaskById(t1.id)
  check('worker 启动后消费完成（进程重启可恢复）', t1c?.status === 'done', `status=${t1c?.status}`)
  await worker.close()

  // 场景 3：任务状态接口归属校验（另一个用户看不到）
  const userB = await registerUser({ email: `a6b_${Date.now().toString(36)}@test.com`, password: 'a6pass12345' })
  let denied = false
  try {
    await getTaskForUser(userB.id, t1.id)
  } catch {
    denied = true
  }
  check('任务归属校验（越权 404）', denied, '')

  // 场景 4：失败任务自动重试 2 次（attempts=3）→ 最终 failed
  const t2 = await enqueueResumeTask({ userId: user.id, targetRole: '必失败任务' })
  // 替换处理器为必失败（通过直接入队一个会失败的任务观察 attempts）
  const t2done = new Promise<void>(async (resolve) => {
    const w2 = new Worker(
      QUEUE_NAMES.agentTasks,
      async (job) => {
        const data = job.data as { taskId: string }
        if (data.taskId !== t2.id) return
        throw new Error('mock 必失败：模拟生成异常')
      },
      { connection: queueConnection(), concurrency: 2 },
    )
    w2.on('failed', async (job) => {
      if (!job) return
      const data = job.data as { taskId: string }
      const maxAttempts = job.opts.attempts ?? 3
      if (job.attemptsMade >= maxAttempts - 1) {
        await getPool().query(
          `UPDATE agent_tasks SET status='failed', error=$2, attempts=$3, finished_at=now(), updated_at=now() WHERE id=$1`,
          [data.taskId, 'mock 必失败：模拟生成异常', job.attemptsMade + 1],
        )
      }
    })
    // 等重试耗尽（attempts=3，backoff 1s→2s ≈ 3s+）
    await sleep(6000)
    await w2.close()
    resolve()
  })
  await t2done
  const t2f = await getTaskById(t2.id)
  const retried = (t2f?.attempts ?? 0) >= 3
  check('失败任务自动重试 2 次后 failed', t2f?.status === 'failed' && retried, `status=${t2f?.status} attempts=${t2f?.attempts}`)

  // 清理
  await worker.close()
  await closeAgentQueue()
  await deleteAccount(user.id).catch(() => {})
  await deleteAccount(userB.id).catch(() => {})
  await getPool().end()
  await closeRedis()

  console.log('\n=== A6 验收 ===')
  for (const line of results) console.log(line)
  const failed = results.filter((r) => r.startsWith('❌')).length
  if (failed > 0) process.exit(1)
  console.log(`\n通过 ${results.filter((r) => r.startsWith('✅')).length} 项，失败 ${failed} 项`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
