import { Router } from 'express'
import { db, id } from '../db.js'

const router = Router()

// 助手对话：本地规则回复（替代线上大模型）
router.post('/agent', (req, res) => {
  const { message } = req.body || {}
  const text = String(message || '')
  let reply =
    '我是 Greenhouse 助手。你可以：在「找岗位」检索岗位、在「机会管线」添加目标岗位、在「简历工作室」准备简历、在「模拟面试」开始练习。'
  if (/面试/.test(text)) reply = '建议先到「模拟面试」选择目标岗位，确定面试官风格、作答方式与题量后开始练习。'
  else if (/简历/.test(text)) reply = '可以到「简历工作室」，从目标岗位开始生成一版针对性简历，或导入现有简历。'
  else if (/岗位|找工作|投递/.test(text)) reply = '到「找岗位」输入目标岗位名称即可检索；也可以在「岗位地图」浏览职能全貌。'
  res.json({ id: id('msg'), role: 'assistant', content: reply })
})

// 模拟面试：返回当前岗位的题目
router.post('/mock', (req, res) => {
  const { oppId } = req.body || {}
  const opp = db().opportunities.find((o) => o.id === oppId)
  res.json({
    questions: opp?.questions ?? [],
    startedAt: new Date().toISOString(),
  })
})

// 生成建议回答（实时助手 / 模拟面试）
router.post('/answer', (req, res) => {
  const { question } = req.body || {}
  res.json({
    answer: `针对问题「${question || ''}」，建议用 STAR 结构回答：先交代背景与目标，再说明你的具体行动，最后用可量化的结果收尾，并回扣岗位要求。`,
  })
})

// 通用生成占位
router.post('/gen', (req, res) => res.json({ ok: true, text: '' }))
router.post('/transcribe', (req, res) => res.json({ text: '', segments: [] }))
router.post('/vision', (req, res) => res.json({ ok: true }))
router.post('/resume-vision', (req, res) => res.json({ ok: true }))

// 推荐 / 学分等
router.get('/referral', (req, res) => res.json({ code: null }))

export default router
