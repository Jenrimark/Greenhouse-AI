// AI 路由（阶段 1：规则占位保留；阶段 2 替换为 ai-gateway / Agent runtime）
import { Router } from 'express'
import { z } from 'zod'
import { id } from '../lib/id.js'
import { ApiError } from '../middleware/error.js'
import { validateBody } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { listOpportunities } from '../services/opportunities.js'

const router = Router()

const agentSchema = z.object({ message: z.string().max(20000).optional().default('') })

// 助手对话：本地规则回复
router.post('/agent', validateBody(agentSchema), (req, res) => {
  const { message } = req.body
  const text = String(message || '')
  let reply =
    '我是 Greenhouse 助手。你可以：在「找岗位」检索岗位、在「机会管线」添加目标岗位、在「简历工作室」准备简历、在「模拟面试」开始练习。'
  if (/面试/.test(text)) reply = '建议先到「模拟面试」选择目标岗位，确定面试官风格、作答方式与题量后开始练习。'
  else if (/简历/.test(text)) reply = '可以到「简历工作室」，从目标岗位开始生成一版针对性简历，或导入现有简历。'
  else if (/岗位|找工作|投递/.test(text)) reply = '到「找岗位」输入目标岗位名称即可检索；也可以在「岗位地图」浏览职能全貌。'
  res.json({ data: { id: id('msg'), role: 'assistant', content: reply } })
})

const mockSchema = z.object({ oppId: z.string().optional() })

// 模拟面试：返回当前用户岗位的题目（需登录）
router.post('/mock', validateBody(mockSchema), asyncHandler(async (req, res) => {
  const { oppId } = req.body
  if (!req.user) throw ApiError.unauthorized()
  const items = await listOpportunities(req.user.id)
  const opp = items.find((o) => o.id === oppId)
  if (!opp) throw ApiError.notFound('机会不存在，请先在机会管线添加目标岗位')
  res.json({ data: { questions: (opp.questions as unknown[]) ?? [], startedAt: new Date().toISOString() } })
}))

const answerSchema = z.object({ question: z.string().max(20000).optional().default('') })

// 生成建议回答（实时助手 / 模拟面试）
router.post('/answer', validateBody(answerSchema), (req, res) => {
  const { question } = req.body
  res.json({
    data: {
      answer: `针对问题「${question || ''}」，建议用 STAR 结构回答：先交代背景与目标，再说明你的具体行动，最后用可量化的结果收尾，并回扣岗位要求。`,
    },
  })
})

// 通用生成占位
router.post('/gen', (_req, res) => res.json({ data: { ok: true, text: '' } }))
router.post('/transcribe', (_req, res) => res.json({ data: { text: '', segments: [] } }))
router.post('/vision', (_req, res) => res.json({ data: { ok: true } }))
router.post('/resume-vision', (_req, res) => res.json({ data: { ok: true } }))

// 推荐 / 学分等
router.get('/referral', (_req, res) => res.json({ data: { code: null } }))

export default router
