// A10.1 集成测试：4 个子图（mock LLM 固定响应）
// 运行：npm run test:subgraphs -w server（需要本地 PG）
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { HumanMessage } from '@langchain/core/messages'
import { MemorySaver } from '@langchain/langgraph'
import {
  createStrategySubgraph,
  createResumeSubgraph,
  createInterviewSubgraph,
  createQaSubgraph,
} from '../src/agent/subgraphs.js'
import { registerUser, deleteAccount } from '../src/services/auth.js'
import { deleteAccount as delAccount } from '../src/services/account.js'
import { getPool } from '../src/db/pool.js'

// mock LLM 固定响应（按 system 关键词返回）
const mockLlm = {
  async invoke(messages: Array<{ getType: () => string; content: unknown }>) {
    const s = String(messages.find((m) => m.getType() === 'system')?.content ?? '')
    const h = String(messages.find((m) => m.getType() === 'human')?.content ?? '')
    if (s.includes('资深 HR')) return { content: '要求：扎实的计算机基础、相关项目经验、良好的沟通协作。' }
    if (s.includes('资深面试官')) return { content: '结构：逻辑清晰（35/40），亮点：有量化结果（30/30），改进：补充协作细节（25/30）。总分 90。' }
    return { content: `（mock）针对「${h.slice(0, 20)}」的固定回答。` }
  },
} as never

let user: { id: string }
let pool: ReturnType<typeof getPool>

before(async () => {
  pool = getPool()
  user = await registerUser({ email: `sub_${Date.now().toString(36)}@test.com`, password: 'subpass12345' })
})

after(async () => {
  await delAccount(user.id).catch(() => {})
  await pool.end()
})

function compile(sub: ReturnType<typeof createStrategySubgraph>) {
  return sub.compile({ checkpointer: new MemorySaver() })
}

const base = (conversationId: string, message: string) => ({
  messages: [new HumanMessage(message)],
  userId: user.id,
  conversationId,
})

describe('子图集成（mock LLM 固定响应）', () => {
  test('strategy：推荐岗位且写机会（唯一线程推进）', async () => {
    const g = compile(createStrategySubgraph(mockLlm))
    const r1 = await g.invoke(base('s1', '目标是大厂后端工程师'), { configurable: { thread_id: `${user.id}:s1` } })
    const last = r1.messages.at(-1) as { content: string }
    assert.ok(String(last.content).includes('星澜科技') || String(last.content).includes('推荐'), '返回推荐岗位')
  })

  test('interview：出题→作答点评→下一题（跨轮推进）', async () => {
    const g = compile(createInterviewSubgraph(mockLlm))
    const cfg = { configurable: { thread_id: `${user.id}:i1` } }
    const r1 = await g.invoke(base('i1', '开始模拟面试，目标岗位：后端'), cfg)
    const c1 = String(r1.messages.at(-1)?.content ?? '')
    assert.ok(c1.includes('【模拟面试 第 1 题】'), '首轮出第 1 题')

    const r2 = await g.invoke(base('i1', '我负责过 Node.js 服务，QPS 提升 3 倍'), cfg)
    const c2 = String(r2.messages.at(-1)?.content ?? '')
    assert.ok(c2.includes('【第 1 题点评】'), '作答后给出点评')
    assert.ok(c2.includes('【下一题】'), '点评附带下一题')

    const r3 = await g.invoke(base('i1', '我主导了 PG 优化，延迟降低 60%'), cfg)
    const c3 = String(r3.messages.at(-1)?.content ?? '')
    assert.ok(c3.includes('【第 2 题点评】'), '第二轮点评第 2 题')
  })

  test('resume：依据画像与 JD 生成简历内容', async () => {
    const g = compile(createResumeSubgraph(mockLlm))
    const r = await g.invoke(base('r1', '请帮我生成后端工程师的简历，JD：熟悉 Node.js 与 PostgreSQL'), {
      configurable: { thread_id: `${user.id}:r1` },
    })
    const c = String(r.messages.at(-1)?.content ?? '')
    assert.ok(c.length > 20, '生成内容非空')
    assert.ok(c.includes('简历草稿') || c.includes('经历库'), '输出简历草稿结构')
  })

  test('qa：结合用户上下文回答', async () => {
    const g = compile(createQaSubgraph(mockLlm))
    const r = await g.invoke(base('q1', '什么是 B+ 树？'), { configurable: { thread_id: `${user.id}:q1` } })
    const c = String(r.messages.at(-1)?.content ?? '')
    assert.ok(c.includes('固定回答') && c.includes('B+ 树'), '基于问题固定回答')
  })
})
