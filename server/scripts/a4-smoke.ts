// A4 验收脚本：PostgresSaver 断点恢复 / 消息落库 / 画像抽取 / 会话互不串扰
// 运行：npm run a4:smoke -w server（需要本地 PG + Redis）
import { HumanMessage } from '@langchain/core/messages'
import { registerUser } from '../src/services/auth.js'
import { deleteAccount } from '../src/services/account.js'
import { createMinimalReAct } from '../src/agent/minimal-react.js'
import { getCheckpointer, threadIdFor } from '../src/agent/checkpointer.js'
import {
  ensureConversation,
  saveMessage,
  listMessages,
  listConversations,
  getProfile,
  upsertProfile,
  extractProfileRuleBased,
  langchainMessageToRows,
} from '../src/services/agentMemory.js'
import { getPool } from '../src/db/pool.js'
import { closeRedis } from '../src/redis/client.js'

const results: string[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const suffix = Date.now().toString(36)
  const user = await registerUser({ email: `a4_${suffix}@test.com`, password: 'a4pass12345', name: 'A4用户' })
  const convA = await ensureConversation(user.id, undefined, 'A4 会话A')
  const convB = await ensureConversation(user.id, undefined, 'A4 会话B')

  // 1. PostgresSaver 接入 + 会话恢复（中断后 resume 上下文不丢）
  const saver = await getCheckpointer()
  const { graph } = createMinimalReAct({ mode: 'mock', checkpointer: saver })
  const threadA = threadIdFor(user.id, convA.id)

  await graph.invoke(
    { messages: [new HumanMessage('第一轮：帮我看看后端岗位')], userId: user.id, conversationId: convA.id },
    { configurable: { thread_id: threadA } },
  )
  await graph.invoke(
    { messages: [new HumanMessage('第二轮：继续')], userId: user.id, conversationId: convA.id },
    { configurable: { thread_id: threadA } },
  )
  const state = await graph.getState({ configurable: { thread_id: threadA } })
  const msgCount = state.values.messages.length
  check('PostgresSaver 会话恢复（同 thread 消息累计）', msgCount >= 6, `累计 ${msgCount} 条`)

  // 2. 会话互不串扰：threadB 独立
  const threadB = threadIdFor(user.id, convB.id)
  await graph.invoke(
    { messages: [new HumanMessage('B 会话内容')], userId: user.id, conversationId: convB.id },
    { configurable: { thread_id: threadB } },
  )
  const stateB = await graph.getState({ configurable: { thread_id: threadB } })
  check('会话切换互不串扰（B 独立上下文）', stateB.values.messages.length < msgCount, `B 累计 ${stateB.values.messages.length} 条（A 为 ${msgCount}）`)

  // 3. 消息落库：user/assistant/tool 消息写 messages 表
  const { messages } = state.values
  for (const m of messages) {
    const row = langchainMessageToRows(convA.id, m)
    await saveMessage({ conversationId: convA.id, ...row })
  }
  const stored = await listMessages(user.id, convA.id)
  const roles = [...new Set(stored.map((s) => s.role))]
  check('消息落库（user/assistant/tool 角色齐全）', roles.includes('user') && roles.includes('assistant') && roles.includes('tool'), roles.join('/'))

  // 4. 会话列表：2 个会话均可见
  const convs = await listConversations(user.id)
  check('会话列表返回 2 条', convs.length === 2, `count=${convs.length}`)

  // 5. 画像抽取（规则版兜底）：目标岗位/技能/经验年数
  const profile = extractProfileRuleBased([
    { role: 'user', content: '我的目标岗位是前端工程师，有 5 年经验，熟练 React 和 TypeScript，也用 Kubernetes。' },
  ])
  check('画像抽取 targetRoles', profile.targetRoles.includes('前端'), JSON.stringify(profile.targetRoles))
  check('画像抽取 skills', profile.skills.includes('React') && profile.skills.includes('TypeScript'), JSON.stringify(profile.skills))
  check('画像抽取 experienceYears', profile.experienceYears === 5, `years=${profile.experienceYears}`)

  // 6. 画像落库 + 回读
  await upsertProfile(user.id, profile)
  const back = await getProfile(user.id)
  check('画像 upsert 后回读一致', back?.targetRoles.includes('前端') && back?.experienceYears === 5, JSON.stringify(back).slice(0, 80))

  // 清理
  await deleteAccount(user.id).catch(() => {})
  await getPool().end()
  await closeRedis()

  console.log('\n=== A4 验收 ===')
  for (const line of results) console.log(line)
  const failed = results.filter((r) => r.startsWith('❌')).length
  if (failed > 0) process.exit(1)
  console.log(`\n通过 ${results.filter((r) => r.startsWith('✅')).length} 项，失败 ${failed} 项`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
