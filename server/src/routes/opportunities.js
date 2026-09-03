import { Router } from 'express'
import { db, save, id } from '../db.js'

const router = Router()

// 根据岗位 + JD 生成预测面试题（本地规则版，替代线上大模型）
function predictQuestions(role, jd) {
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

// 列表
router.get('/', (req, res) => {
  const { stage } = req.query
  let items = db().opportunities
  if (stage && stage !== 'all') items = items.filter((o) => o.stage === stage)
  res.json({ items })
})

// 汇总（待办数量等）
router.get('/summary', (req, res) => {
  const items = db().opportunities
  const due = items.filter((o) => o.stage !== 'closed' && o.nextAction?.due).length
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
  if (!item) return res.status(404).json({ error: '机会不存在' })
  res.json(item)
})

// 新建岗位：同时生成匹配度与预测面试题
router.post('/', (req, res) => {
  const { company, role, jd, location, salary } = req.body || {}
  if (!company?.trim() || !role?.trim()) {
    return res.status(400).json({ error: '公司与岗位不能为空' })
  }
  const state = db()
  const item = {
    id: id('opp'),
    company: company.trim(),
    role: role.trim(),
    jd: (jd || '').trim(),
    location: location || '',
    salary: salary || '',
    stage: 'applied',
    match: jd ? 70 + Math.floor(Math.random() * 22) : null,
    questions: predictQuestions(role.trim(), jd || ''),
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

// 更新（阶段、字段）
router.patch('/:id', (req, res) => {
  const item = db().opportunities.find((o) => o.id === req.params.id)
  if (!item) return res.status(404).json({ error: '机会不存在' })
  const allowed = ['stage', 'location', 'salary', 'jd', 'match', 'nextAction']
  for (const k of allowed) if (k in (req.body || {})) item[k] = req.body[k]
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
