// A7 Agent runtime API：POST /api/agent/chat（requireAuth + 每用户限流 + 并发锁 + zod 校验）
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/requireAuth.js'
import { validateBody } from '../middleware/validate.js'
import { rateLimitByUser } from '../redis/rateLimit.js'
import { acquireAgentLock, runAgentChat } from '../agent/runtime.js'

const router = Router()

const chatSchema = z.object({
  message: z.string().min(1).max(4000).describe('用户消息'),
  conversationId: z.string().uuid().optional().describe('会话 ID（续聊时传入）'),
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
      })
      res.json({ data: result })
    } catch (err) {
      next(err)
    } finally {
      if (release) await release().catch(() => {})
    }
  },
)

export default router
