// A3 工具层：现有业务 service → LangGraph tools
// 关键安全约束：userId 由闭包绑定，工具入参 schema 不含 user_id；
// 即使调用方（LLM）在入参里塞 user_id 也会被 zod 剥掉，数据隔离以闭包为准。
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { createOpportunity, updateOpportunity, deleteOpportunity } from '../services/opportunities.js'
import { listStories, createStory } from '../services/stories.js'
import { getLatestResume } from '../services/resumes.js'
import { getMe, getCredits } from '../services/account.js'
import { searchJobs } from '../services/jobSearch.js'

/** 简历生成：A6 异步任务前为占位实现 */
const GENERATE_RESUME_PLACEHOLDER = true

/** 生成绑定指定 userId 的工具集（工具内部不信任入参 user_id） */
export function createAgentTools(userId: string) {
  return [
    // ---- 岗位检索 ----
    tool(
      async (input: { keywords?: string; city?: string; years?: number; salary?: number; remoteOnly?: boolean }) => {
        const { items, total } = searchJobs(input)
        return JSON.stringify({ total, items })
      },
      {
        name: 'search_jobs',
        description:
          '检索当前可投递的岗位。入参：keywords 关键词（如"前端工程师"）、city 城市（beijing/shanghai/shenzhen/hangzhou/wuhan/remote/any）、years 经验年数、salary 期望月薪（K）、remoteOnly 是否只看远程。返回岗位列表，含公司、薪资范围、经验要求、标签与职责摘要。',
        schema: z.object({
          keywords: z.string().max(100).optional().describe('岗位关键词，如 前端工程师'),
          city: z.string().max(20).optional().describe('城市：beijing/shanghai/shenzhen/hangzhou/wuhan/remote/any'),
          years: z.number().int().min(0).max(50).optional().describe('经验年数'),
          salary: z.number().int().min(0).optional().describe('期望月薪（K）'),
          remoteOnly: z.boolean().optional().describe('是否只看远程'),
        }),
      },
    ),

    // ---- 机会管理 ----
    tool(
      async (input: { company: string; role: string; jd?: string; location?: string; salary?: string }) => {
        const opp = await createOpportunity(userId, input)
        return JSON.stringify(opp)
      },
      {
        name: 'add_opportunity',
        description:
          '把一份新机会加入求职管线。入参：company 公司名、role 岗位名、jd 职位描述（可选）、location 地点（可选）、salary 薪资（可选）。返回创建后的机会对象。',
        schema: z.object({
          company: z.string().min(1).max(100).describe('公司名'),
          role: z.string().min(1).max(100).describe('岗位名'),
          jd: z.string().max(5000).optional().describe('职位描述（JD）'),
          location: z.string().max(100).optional().describe('工作地点'),
          salary: z.string().max(100).optional().describe('薪资，如 25-35K·14薪'),
        }),
      },
    ),
    tool(
      async (input: { id: string; stage?: string; location?: string; salary?: string; jd?: string }) => {
        const opp = await updateOpportunity(userId, input.id, input)
        return JSON.stringify(opp)
      },
      {
        name: 'update_opportunity',
        description:
          '更新管线中某机会的字段（阶段/地点/薪资/JD）。入参 id 为该机会的 uuid；stage 可选值为 applied/interviewing/offer/closed（投递/面试/Offer/关闭）。只能操作当前用户自己的机会。',
        schema: z.object({
          id: z.string().describe('机会 uuid'),
          stage: z
            .enum(['applied', 'interviewing', 'offer', 'closed'])
            .optional()
            .describe('阶段：applied 投递 / interviewing 面试 / offer Offer / closed 关闭'),
          location: z.string().max(100).optional().describe('工作地点'),
          salary: z.string().max(100).optional().describe('薪资'),
          jd: z.string().max(5000).optional().describe('职位描述'),
        }),
      },
    ),
    tool(
      async (input: { id: string }) => {
        await deleteOpportunity(userId, input.id)
        return JSON.stringify({ ok: true, id: input.id })
      },
      {
        name: 'delete_opportunity',
        description: '删除管线中的一份机会。入参 id 为机会 uuid；只能删除当前用户自己的机会。',
        schema: z.object({ id: z.string().describe('机会 uuid') }),
      },
    ),

    // ---- 经历库 ----
    tool(
      async () => {
        const stories = await listStories(userId)
        return JSON.stringify({ count: stories.length, stories })
      },
      {
        name: 'list_stories',
        description: '列出当前用户的经历库（工作经历/项目），用于简历与面试素材。',
        schema: z.object({}),
      },
    ),
    tool(
      async (input: { title: string; org?: string; start?: string; end?: string; bullets?: string[]; tags?: string[] }) => {
        const story = await createStory(userId, input)
        return JSON.stringify(story)
      },
      {
        name: 'add_story',
        description:
          '向经历库新增一条经历（工作/项目）。入参：title 标题、org 组织、start/end 起止时间（如 2022-01）、bullets 要点数组、tags 标签数组。',
        schema: z.object({
          title: z.string().min(1).max(200).describe('经历标题'),
          org: z.string().max(100).optional().describe('组织/公司'),
          start: z.string().max(20).optional().describe('开始时间 YYYY-MM'),
          end: z.string().max(20).optional().describe('结束时间 YYYY-MM 或至今'),
          bullets: z.array(z.string().max(500)).max(20).optional().describe('成就要点'),
          tags: z.array(z.string().max(50)).max(20).optional().describe('标签'),
        }),
      },
    ),

    // ---- 用户画像 / 简历 ----
    tool(
      async () => {
        const me = await getMe(userId)
        const credits = await getCredits(userId)
        return JSON.stringify({ id: me.id, name: me.name, handle: me.handle, email: me.email, credits })
      },
      {
        name: 'get_user_profile',
        description: '获取当前用户的画像信息（姓名/昵称/邮箱/积分余额），用于个性化求职建议。',
        schema: z.object({}),
      },
    ),
    tool(
      async () => {
        const resume = await getLatestResume(userId)
        return resume ? JSON.stringify(resume) : JSON.stringify({ status: 'empty', message: '用户还没有简历，可引导创建' })
      },
      {
        name: 'read_resume',
        description: '读取当前用户最新一份简历的内容与结构，用于简历分析、润色与面试准备。',
        schema: z.object({}),
      },
    ),
    tool(
      async (input: { targetRole: string; jd?: string }) => {
        if (GENERATE_RESUME_PLACEHOLDER) {
          return JSON.stringify({
            status: 'pending',
            message: `已收到简历生成请求（目标岗位：${input.targetRole}）。该能力将在异步队列上线后执行（A6），当前请引导用户稍后重试。`,
          })
        }
        return JSON.stringify({ status: 'pending', targetRole: input.targetRole, jd: input.jd ?? '' })
      },
      {
        name: 'generate_resume',
        description: '根据目标岗位与 JD 生成一份定制简历。入参：targetRole 目标岗位、jd 职位描述（可选）。返回任务状态。',
        schema: z.object({
          targetRole: z.string().min(1).max(100).describe('目标岗位'),
          jd: z.string().max(5000).optional().describe('职位描述'),
        }),
      },
    ),
  ]
}

/** 工具名注册表（供意图路由 / 前端展示） */
export const AGENT_TOOL_NAMES = [
  'search_jobs',
  'add_opportunity',
  'update_opportunity',
  'delete_opportunity',
  'list_stories',
  'add_story',
  'get_user_profile',
  'read_resume',
  'generate_resume',
] as const
