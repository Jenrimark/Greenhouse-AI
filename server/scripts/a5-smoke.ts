// A5 验收脚本：4 子图独立执行 / 主编排图 5 路由 × 2 用例 / 意图路由准确率抽查 20 条
// 运行：npm run a5:smoke -w server（mock 模式无需 API key）
import { HumanMessage } from '@langchain/core/messages'
import { MemorySaver } from '@langchain/langgraph'
import { createStrategySubgraph, createResumeSubgraph, createInterviewSubgraph, createQaSubgraph } from '../src/agent/subgraphs.js'
import { createOrchestrator, mockLlm } from '../src/agent/orchestrator.js'
import { classifyIntentRuleBased, type Intent } from '../src/agent/intent-router.js'
import { registerUser } from '../src/services/auth.js'
import { deleteAccount } from '../src/services/account.js'
import { getPool } from '../src/db/pool.js'
import { closeRedis } from '../src/redis/client.js'

const results: string[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const llm = mockLlm()

async function main() {
  const user = await registerUser({ email: `a5_${Date.now().toString(36)}@test.com`, password: 'a5pass12345', name: 'A5用户' })
  const UID = user.id
  // 1. 子图可独立执行（各 2 个用例）
  const strategy = createStrategySubgraph(llm).compile({ checkpointer: new MemorySaver() })
  const s1 = await strategy.invoke({ messages: [new HumanMessage('帮我看看前端岗位机会')], userId: UID }, { configurable: { thread_id: 's1' } })
  const s2 = await strategy.invoke({ messages: [new HumanMessage('确认')], userId: UID }, { configurable: { thread_id: 's2' } })
  check('strategy 子图独立执行（推荐清单）', s1.messages.at(-1)?.content.includes('推荐'), String(s1.messages.at(-1)?.content).slice(0, 30))
  check('strategy 子图确认加入管线', String(s2.messages.at(-1)?.content).includes('加入求职管线'), String(s2.messages.at(-1)?.content).slice(0, 30))

  const resume = createResumeSubgraph(llm).compile({ checkpointer: new MemorySaver() })
  const r1 = await resume.invoke({ messages: [new HumanMessage('根据我的经历生成简历')], userId: UID }, { configurable: { thread_id: 'r1' } })
  const r2 = await resume.invoke({ messages: [new HumanMessage('保存')], userId: UID }, { configurable: { thread_id: 'r2' } })
  check('resume 子图独立执行（草稿）', String(r1.messages.at(-1)?.content).includes('简历草稿'), String(r1.messages.at(-1)?.content).slice(0, 30))
  check('resume 子图保存简历', String(r2.messages.at(-1)?.content).includes('已保存'), String(r2.messages.at(-1)?.content).slice(0, 30))

  const interview = createInterviewSubgraph(llm).compile({ checkpointer: new MemorySaver() })
  const i1 = await interview.invoke({ messages: [new HumanMessage('开始模拟面试')], userId: UID }, { configurable: { thread_id: 'i1' } })
  const i2 = await interview.invoke({ messages: [new HumanMessage('我主导过容器平台重构，P95 延迟下降 40%')], userId: UID }, { configurable: { thread_id: 'i2' } })
  check('interview 子图独立执行（出题）', String(i1.messages.at(-1)?.content).includes('模拟面试'), String(i1.messages.at(-1)?.content).slice(0, 30))
  check('interview 子图打分点评', String(i2.messages.at(-1)?.content).includes('点评'), String(i2.messages.at(-1)?.content).slice(0, 30))

  const qa = createQaSubgraph(llm).compile({ checkpointer: new MemorySaver() })
  const q1 = await qa.invoke({ messages: [new HumanMessage('什么是 TCP 三次握手')], userId: UID }, { configurable: { thread_id: 'q1' } })
  check('qa 子图独立执行', String(q1.messages.at(-1)?.content).includes('建议'), String(q1.messages.at(-1)?.content).slice(0, 30))

  // 2. 主编排图：5 条路由 × 2 用例（mock 意图路由 + mock 子图 LLM）
  const orch = createOrchestrator({ mode: 'mock' })
  const cases: Array<[string, Intent]> = [
    ['帮我制定求职策略，目标是大厂后端', 'strategy'],
    ['分析一下我该投哪些岗位方向', 'strategy'],
    ['帮我优化一下简历', 'resume'],
    ['根据这个 JD 写一份简历', 'resume'],
    ['模拟面试开始吧', 'interview'],
    ['面试中如何回答离职原因', 'interview'],
    ['解释一下 React 的虚拟 DOM', 'qa'],
    ['Redis 和 Memcached 有什么区别', 'qa'],
    ['你好', 'chat'],
    ['谢谢你，再见', 'chat'],
  ]
  let routerOk = 0
  for (const [text, expected] of cases) {
    const out = await orch.invoke({ messages: [new HumanMessage(text)], userId: UID }, { configurable: { thread_id: `orch-${cases.indexOf([text, expected] as any)}` } })
    const got = out.intent ?? 'qa'
    const last = out.messages.at(-1)
    const hasReply = !!last?.content && last?.getType?.() === 'ai'
    if (got === expected && hasReply) routerOk++
  }
  check('主编排图 5 路由 × 2 用例（意图正确 + 有回复）', routerOk === cases.length, `${routerOk}/${cases.length}`)

  // 3. 意图路由准确率 ≥ 90%（抽查 20 条）
  const samples: Array<[string, Intent]> = [
    ['求职策略怎么定', 'strategy'],
    ['想找机会', 'strategy'],
    ['帮我投递试试', 'strategy'],
    ['机会太多怎么选', 'strategy'],
    ['目标岗位规划', 'strategy'],
    ['简历看看', 'resume'],
    ['优化简历', 'resume'],
    ['写简历', 'resume'],
    ['简历怎么改', 'resume'],
    ['简历润色一下', 'resume'],
    ['模拟面试', 'interview'],
    ['面试技巧', 'interview'],
    ['面经', 'interview'],
    ['如何准备面试', 'interview'],
    ['八股文', 'interview'],
    ['K8s 是什么', 'qa'],
    ['怎么解释深拷贝', 'qa'],
    ['什么是索引', 'qa'],
    ['为什么用 Redis', 'qa'],
    ['你好呀', 'chat'],
  ]
  const wrong = samples.filter(([text, want]) => classifyIntentRuleBased(text) !== want)
  const acc = ((samples.length - wrong.length) / samples.length) * 100
  check(`意图路由准确率 ≥ 90%（抽查 20 条）`, acc >= 90, `准确率 ${acc}%${wrong.length ? `，误判：${wrong.map((w) => w[0]).join('、')}` : ''}`)

  console.log('\n=== A5 验收 ===')
  for (const line of results) console.log(line)
  const failed = results.filter((r) => r.startsWith('❌')).length
  if (failed > 0) process.exit(1)
  console.log(`\n通过 ${results.filter((r) => r.startsWith('✅')).length} 项，失败 ${failed} 项`)
  await deleteAccount(user.id).catch(() => {})
  await getPool().end()
  await closeRedis()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
