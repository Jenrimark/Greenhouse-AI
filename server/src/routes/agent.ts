// A7/A8 Agent runtime API：对话 + 会话列表/消息 + 简历异步生成
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateBody } from '../middleware/validate.js'
import { rateLimitByUser } from '../redis/rateLimit.js'
import { acquireAgentLock, runAgentChat } from '../agent/runtime.js'
import { listConversations, listMessages } from '../services/agentMemory.js'
import { enqueueResumeTask } from '../queue/tasks.js'

const router = Router()

const chatSchema = z.object({
  message: z.string().min(1).max(4000).describe('用户消息'),
  conversationId: z.string().uuid().optional().describe('会话 ID（续聊时传入）'),
  forceIntent: z.enum(['strategy', 'resume', 'interview', 'qa', 'chat']).optional().describe('显式指定意图（跳过自动路由）'),
})

// 每用户限流：20 次 / 分钟
router.post(
  '/chat',
  requireAuth,
  rateLimitByUser({ name: 'agent:chat', limit: 20, windowSec: 60 }),
  validateBody(chatSchema),
  async (req, res, next) => {
    const userId = req.user!.id
    let release: (() => Promise<void>) | null = null
    try {
      release = await acquireAgentLock(userId)
      const result = await runAgentChat({
        userId,
        message: req.body.message,
        conversationId: req.body.conversationId,
        forceIntent: req.body.forceIntent,
      })
      res.json({ data: result })
    } catch (err) {
      next(err)
    } finally {
      if (release) await release().catch(() => {})
    }
  },
)

// 会话列表（按更新时间倒序）
router.get('/conversations', requireAuth, async (req, res, next) => {
  try {
    const list = await listConversations(req.user!.id)
    res.json({ data: { items: list } })
  } catch (err) {
    next(err)
  }
})

// 会话消息（校验归属）
router.get('/conversations/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const convId = req.params.id
    if (!convId) return next(new Error('缺少会话 ID'))
    const items = await listMessages(req.user!.id, convId)
    res.json({ data: { items } })
  } catch (err) {
    next(err)
  }
})

// 简历异步生成（A6 worker 消费；前端轮询任务状态）
router.post(
  '/resume/generate',
  requireAuth,
  rateLimitByUser({ name: 'agent:resume', limit: 5, windowSec: 3600 }),
  validateBody(z.object({ targetRole: z.string().min(1).max(100), jd: z.string().max(5000).optional() })),
  async (req, res, next) => {
    try {
      const task = await enqueueResumeTask({
        userId: req.user!.id,
        targetRole: req.body.targetRole,
        jd: req.body.jd ?? '',
      })
      res.status(202).json({ data: { taskId: task.id, status: task.status } })
    } catch (err) {
      next(err)
    }
  },
)

export default router
