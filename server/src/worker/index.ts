// A6 Worker 进程：消费 bullmq 异步任务（简历生成等）
// 失败自动重试 2 次（队列 attempts=3 + 指数退避）；重试耗尽后标记 failed + 告警日志
import { Worker, type Job } from 'bullmq'
import { queueConnection, QUEUE_NAMES } from '../queue/config.js'
import {
  RESUME_TASK,
  getTaskById,
  updateTaskStatus,
} from '../queue/tasks.js'
import { listStories } from '../services/stories.js'
import { getProfile } from '../services/agentMemory.js'
import { createResume } from '../services/resumes.js'
import { logger } from '../lib/logger.js'

interface ResumeJobData {
  taskId: string
  userId: string
}

/** 简历生成处理器：读经历+画像 → 生成草稿 → 写入 resumes 表 → 任务 done */
async function handleResumeGenerate(job: Job<ResumeJobData>): Promise<Record<string, unknown>> {
  const { taskId, userId } = job.data
  const task = await getTaskById(taskId)
  if (!task) throw new Error(`任务不存在: ${taskId}`)

  await updateTaskStatus(taskId, { status: 'running', attempts: job.attemptsMade + 1 })

  const payload = (task.input ?? {}) as { targetRole?: string; jd?: string }
  const stories = await listStories(userId)
  const profile = await getProfile(userId)

  // 规则版生成：经历要点 + 画像 → 简历内容（A9 可接入 LLM 生成）
  const bullets = stories.slice(0, 5).map((s) => {
    const b = ((s.bullets ?? []) as string[]).slice(0, 3)
    return { title: s.title, org: s.org, start: s.start, end: s.end, bullets: b }
  })
  const content = {
    version: 'ai-v1',
    targetRole: payload.targetRole ?? '',
    jd: payload.jd ?? '',
    profile: {
      targetRoles: (profile?.targetRoles ?? []) as string[],
      skills: (profile?.skills ?? []) as string[],
      experienceYears: profile?.experienceYears ?? null,
    },
    experiences: bullets,
    generatedAt: new Date().toISOString(),
  }
  // 并发保护：同用户旧 AI 草稿标记，仅保留最新
  const saved = await createResume(userId, {
    title: `AI 简历 · ${payload.targetRole || '求职'} (${new Date().toISOString().slice(0, 10)})`,
    content,
  })

  const output = { resumeId: saved.id, title: saved.title, summary: `已生成 ${bullets.length} 段经历的简历草稿` }
  await updateTaskStatus(taskId, { status: 'done', output, finishedAt: new Date() })
  return output
}

export function startAgentWorker(): Worker {
  const worker = new Worker<ResumeJobData>(
    QUEUE_NAMES.agentTasks,
    async (job) => {
      switch (job.name) {
        case RESUME_TASK:
          return await handleResumeGenerate(job)
        default:
          throw new Error(`未知任务类型: ${job.name}`)
      }
    },
    {
      connection: queueConnection(),
      concurrency: 2,
    },
  )

  worker.on('failed', async (job, err) => {
    // 告警 + 重试耗尽后把任务标记为 failed（attempts=3 → attemptsMade 达 2 即耗尽）
    if (job) {
      const data = job.data as ResumeJobData
      const maxAttempts = job.opts.attempts ?? 3
      if (job.attemptsMade >= maxAttempts - 1) {
        await updateTaskStatus(data.taskId, {
          status: 'failed',
          error: err.message.slice(0, 500),
          attempts: job.attemptsMade + 1,
          finishedAt: new Date(),
        }).catch(() => {})
      }
    }
    logger.error(
      { jobId: job?.id, taskId: (job?.data as ResumeJobData)?.taskId, attempt: job?.attemptsMade, error: err.message },
      '异步任务执行失败',
    )
  })
  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, taskId: (job.data as ResumeJobData)?.taskId }, '异步任务完成')
  })
  worker.on('error', (err) => {
    logger.error({ error: err.message }, 'worker 连接错误')
  })

  return worker
}

// 直接运行（node dist/worker/index.js）时启动
const isMain = process.argv[1]?.endsWith('worker/index.js')
if (isMain) {
  const worker = startAgentWorker()
  logger.info({ worker: true }, 'Greenhouse Worker 已启动（bullmq）')
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, async () => {
      logger.info({ sig }, 'worker 退出')
      await worker.close()
      process.exit(0)
    })
  }
}
