// 岗位检索路由（演示数据；阶段 2 由 AI 工具层复用 service）
import { Router } from 'express'
import { z } from 'zod'
import { id } from '../db.js'
import { validateBody } from '../middleware/validate.js'

const router = Router()

const COMPANIES = ['星澜科技', '云启智能', '北辰互联', '青禾网络', '山海数字', '沐光软件', '澄江信息', '远舟数据']
const CITY: Record<string, string> = {
  beijing: '北京',
  shanghai: '上海',
  shenzhen: '深圳',
  hangzhou: '杭州',
  wuhan: '武汉',
  remote: '远程',
  any: '一线 / 新一线',
}

const searchSchema = z.object({
  keywords: z.string().max(100).optional().default(''),
  city: z.string().max(20).optional().default('any'),
  years: z.coerce.number().int().min(0).max(50).optional(),
  salary: z.coerce.number().int().min(0).optional(),
  remoteOnly: z.coerce.boolean().optional().default(false),
})

// 公开岗位检索（本地演示：按关键词确定性生成候选岗位）
router.post('/', validateBody(searchSchema), (req, res) => {
  const { keywords, city, salary, remoteOnly } = req.body
  const kw = keywords.trim()
  const role = kw.split(/[,，、\s]+/).filter(Boolean)[0] || '产品经理'
  const loc = CITY[city] ?? CITY.any ?? ''
  const n = 6
  const items = Array.from({ length: n }, (_, i) => {
    const company = COMPANIES[(i + role.length) % COMPANIES.length]
    const base = 18 + ((i * 7 + role.length) % 22)
    return {
      id: id('job'),
      role: i === 0 ? role : `${role}（${['初级', '高级', '资深', '', '方向负责人', '专家'][i] || ''}）`.replace('（）', ''),
      company,
      location: remoteOnly ? '远程' : loc,
      salary: `${base}-${base + 12}K·${13 + (i % 3)}薪`,
      exp: `${[1, 3, 3, 5, 5, 10][i]}-${[3, 5, 5, 10, 10, 15][i]} 年`,
      remote: !!remoteOnly,
      tags: [['五险一金', '弹性工作', '双休'][i % 3], ['成长快', '技术氛围', '导师制'][(i + 1) % 3]],
      summary: `负责${role}相关工作，参与产品从规划到落地的完整流程，与研发、设计、运营紧密协作。`,
    }
  })
  const filtered = items.filter((j) => {
    if (salary && parseInt(j.salary) < salary) return false
    return true
  })
  setTimeout(() => res.json({ items: filtered, total: filtered.length }), 260)
})

export default router
