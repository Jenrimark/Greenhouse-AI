// A6 任务状态接口：GET /api/agent/tasks/:id（requireAuth + 归属校验）
import { Router } from 'express'
import { getTaskForUser } from '../queue/tasks.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.get('/tasks/:id', requireAuth, async (req, res, next) => {
  try {
    const uid = req.user?.id
    if (!uid) return next(new Error('未认证'))
    const taskId = req.params.id
    if (!taskId) return next(new Error('缺少任务 ID'))
    const task = await getTaskForUser(uid, taskId)
    res.json({
      data: {
        id: task.id,
        type: task.type,
        status: task.status,
        attempts: task.attempts,
        output: task.output,
        error: task.error,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        finishedAt: task.finishedAt,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
