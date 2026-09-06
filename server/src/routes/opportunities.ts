// 机会管线路由（阶段 1 A 任务：演示版；F 任务按 user_id 隔离落 PostgreSQL）
import { Router } from 'express'
import { z } from 'zod'
import { db, save, id } from '../db.js'
import { ApiError } from '../middleware/error.js'
import { validateBody, validateQuery } from '../middleware/validate.js'

const router = Router()

// 根据岗位 + JD 生成预测面试题（本地规则版，替代线上大模型）
function predictQuestions(role: string, jd: string): Array<{ id: string; text: string }> {
  const base = [
    `请做一个简短的自我介绍，并说明为什么应聘「${role}」这个岗位。`,
    `结合你的经历，讲一个最能体现你胜任「${role}」的项目，你具体负责什么、结果如何？`,
    '遇到需求紧急、资源不足或意见冲突时，你是如何推进并落地的？请举具体例子。',
    '你如何看待这个岗位未来一到两年的变化？你会如何补齐自己还不具备的能力？',
    '你有什么想问我们的？',
  ]
  if (jd && jd.length > 40) {
    base.splice(3, 0, '这份岗位描述中你认为最关键的三项要求是什么？你分别达到什么程度？')
  }
  return base.map((text, i) => ({ id: id('q'), text }))
}

const listQuerySchema = z.object({
  stage: z.string().optional(),
})

// 列表
router.get('/', validateQuery(listQuerySchema), (req, res) => {
  const { stage } = req.query
  let items = db().opportunities
  if (stage && stage !== 'all') items = items.filter((o) => o.stage === stage)
  res.json({ items })
})

// 汇总（待办数量等）
router.get('/summary', (_req, res) => {
  const items = db().opportunities
  const due = items.filter((o) => o.stage !== 'closed' && (o.nextAction as { due?: unknown } | null)?.due).length
  res.json({
    total: items.length,
    due,
    byStage: {
      applied: items.filter((o) => o.stage === 'applied').length,
      interview: items.filter((o) => o.stage === 'interview').length,
      offer: items.filter((o) => o.stage === 'offer').length,
      closed: items.filter((o) => o.stage === 'closed').length,
    },
  })
})

// 单条
router.get('/:id', (req, res) => {
  const item = db().opportunities.find((o) => o.id === req.params.id)
  if (!item) throw ApiError.notFound('机会不存在')
  res.json(item)
})

const createSchema = z.object({
  company: z.string().trim().min(1, '公司不能为空').max(100),
  role: z.string().trim().min(1, '岗位不能为空').max(100),
  jd: z.string().max(20000).optional().default(''),
  location: z.string().max(100).optional().default(''),
  salary: z.string().max(100).optional().default(''),
})

// 新建岗位：同时生成匹配度与预测面试题
router.post('/', validateBody(createSchema), (req, res) => {
  const { company, role, jd, location, salary } = req.body
  const state = db()
  const item = {
    id: id('opp'),
    company,
    role,
    jd,
    location,
    salary,
    stage: 'applied',
    match: jd ? 70 + Math.floor(Math.random() * 22) : null,
    questions: predictQuestions(role, jd),
    rounds: [],
    nextAction: { label: '完善职位描述', due: null },
    dueAt: null,
    sample: false,
    createdAt: new Date().toISOString(),
  }
  state.opportunities.unshift(item)
  save()
  res.status(201).json(item)
})

const patchSchema = z.object({
  stage: z.string().max(30).optional(),
  location: z.string().max(100).optional(),
  salary: z.string().max(100).optional(),
  jd: z.string().max(20000).optional(),
  match: z.number().int().min(0).max(100).nullable().optional(),
  nextAction: z.record(z.unknown()).nullable().optional(),
})

// 更新（阶段、字段）
router.patch('/:id', validateBody(patchSchema), (req, res) => {
  const item = db().opportunities.find((o) => o.id === req.params.id)
  if (!item) throw ApiError.notFound('机会不存在')
  for (const [k, v] of Object.entries(req.body)) {
    if (v !== undefined) item[k] = v
  }
  save()
  res.json(item)
})

router.delete('/:id', (req, res) => {
  const state = db()
  state.opportunities = state.opportunities.filter((o) => o.id !== req.params.id)
  save()
  res.status(204).end()
})

export default router
