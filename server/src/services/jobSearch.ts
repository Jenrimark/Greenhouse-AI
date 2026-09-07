// 岗位检索 service（A3 从 discover 路由抽出，路由与 AI 工具共用）
import { id } from '../lib/id.js'

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

export interface JobSearchInput {
  keywords?: string
  city?: string
  years?: number
  salary?: number
  remoteOnly?: boolean
}

export interface JobItem {
  id: string
  role: string
  company: string
  location: string
  salary: string
  exp: string
  remote: boolean
  tags: string[]
  summary: string
}

/** 本地演示：按关键词确定性生成候选岗位（阶段 2 可替换为真实岗位数据源） */
export function searchJobs(input: JobSearchInput): { items: JobItem[]; total: number } {
  const { keywords = '', city = 'any', salary, remoteOnly = false } = input
  const kw = keywords.trim()
  const role = kw.split(/[,，、\s]+/).filter(Boolean)[0] || '产品经理'
  const loc = CITY[city] ?? CITY.any ?? ''
  const n = 6
  const items: JobItem[] = Array.from({ length: n }, (_, i) => {
    const company = COMPANIES[(i + role.length) % COMPANIES.length] ?? ''
    const base = 18 + ((i * 7 + role.length) % 22)
    const suffix = ['初级', '高级', '资深', '', '方向负责人', '专家'][i] ?? ''
    const tag1 = ['五险一金', '弹性工作', '双休'][i % 3] ?? ''
    const tag2 = ['成长快', '技术氛围', '导师制'][(i + 1) % 3] ?? ''
    return {
      id: id('job'),
      role: i === 0 ? role : `${role}（${suffix}）`.replace('（）', ''),
      company,
      location: remoteOnly ? '远程' : loc,
      salary: `${base}-${base + 12}K·${13 + (i % 3)}薪`,
      exp: `${[1, 3, 3, 5, 5, 10][i] ?? 1}-${[3, 5, 5, 10, 10, 15][i] ?? 15} 年`,
      remote: !!remoteOnly,
      tags: [tag1, tag2],
      summary: `负责${role}相关工作，参与产品从规划到落地的完整流程，与研发、设计、运营紧密协作。`,
    }
  })
  const filtered = items.filter((j) => !(salary && parseInt(j.salary) < salary))
  return { items: filtered, total: filtered.length }
}
