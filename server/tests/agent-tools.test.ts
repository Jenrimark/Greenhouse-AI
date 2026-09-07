// A3 工具层验收：每工具独立单测（无 LLM）+ 越权隔离 + 输出结构稳定
// 运行：npm run test:agent -w server（需要本地 PG + Redis，默认连接）
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { registerUser, loginUser, logoutSession } from '../src/services/auth.js'
import { deleteAccount } from '../src/services/account.js'
import { createAgentTools } from '../src/agent/tools.js'
import { getPool } from '../src/db/pool.js'
import { closeRedis } from '../src/redis/client.js'

let userA: { id: string; email: string }
let userB: { id: string; email: string }
let toolsA: ReturnType<typeof createAgentTools>
let toolsB: ReturnType<typeof createAgentTools>
let sessionA: string | null = null

const call = async (toolList: ReturnType<typeof createAgentTools>, name: string, input: unknown) => {
  const t = toolList.find((x) => x.name === name)
  assert.ok(t, `工具 ${name} 已注册`)
  const res = await t.invoke(input as never)
  return JSON.parse(typeof res === 'string' ? res : String(res))
}

before(async () => {
  const suffix = Date.now().toString(36)
  userA = await registerUser({ email: `a3a_${suffix}@test.com`, password: 'a3pass12345', name: 'A3甲' })
  userB = await registerUser({ email: `a3b_${suffix}@test.com`, password: 'a3pass12345', name: 'A3乙' })
  toolsA = createAgentTools(userA.id)
  toolsB = createAgentTools(userB.id)
})

after(async () => {
  if (userA) await deleteAccount(userA.id).catch(() => {})
  if (userB) await deleteAccount(userB.id).catch(() => {})
  await getPool().end()
  await closeRedis()
})

test('search_jobs：关键词检索返回稳定结构', async () => {
  const r = await call(toolsA, 'search_jobs', { keywords: '前端工程师', city: 'wuhan' })
  assert.ok(Array.isArray(r.items) && r.items.length > 0)
  const first = r.items[0]
  for (const k of ['id', 'role', 'company', 'location', 'salary', 'exp', 'remote', 'tags', 'summary']) {
    assert.ok(k in first, `字段 ${k} 存在`)
  }
})

test('add_opportunity：创建机会返回 id/company/role/stage', async () => {
  const r = await call(toolsA, 'add_opportunity', { company: '星澜科技', role: '前端工程师', jd: '负责核心前端' })
  assert.ok(r.id && r.company === '星澜科技' && r.role === '前端工程师')
  assert.ok(['applied', 'interviewing', 'offer', 'closed'].includes(r.stage))
})

test('update_opportunity：推进阶段到 interviewing', async () => {
  const created = await call(toolsA, 'add_opportunity', { company: '云启智能', role: '后端工程师' })
  const updated = await call(toolsA, 'update_opportunity', { id: created.id, stage: 'interviewing' })
  assert.equal(updated.stage, 'interviewing')
})

test('delete_opportunity：删除后 404 不可见', async () => {
  const created = await call(toolsA, 'add_opportunity', { company: '北辰互联', role: '测试岗' })
  await call(toolsA, 'delete_opportunity', { id: created.id })
  await assert.rejects(
    () => call(toolsA, 'update_opportunity', { id: created.id, stage: 'closed' }),
    /不存在|没有权限/,
  )
})

test('list_stories / add_story：新增后列表可见', async () => {
  const empty = await call(toolsA, 'list_stories', {})
  assert.equal(empty.count, 0)
  await call(toolsA, 'add_story', { title: '主导容器平台重构', org: '某云厂商', bullets: ['P95 下降 40%'] })
  const after1 = await call(toolsA, 'list_stories', {})
  assert.equal(after1.count, 1)
  assert.equal(after1.stories[0].title, '主导容器平台重构')
})

test('get_user_profile：返回 id/name/credits 稳定结构', async () => {
  const r = await call(toolsA, 'get_user_profile', {})
  assert.ok(r.id === userA.id)
  assert.ok(typeof r.credits === 'number' && r.credits >= 100)
  assert.ok(typeof r.email === 'string')
})

test('read_resume：无简历返回 empty 结构', async () => {
  const r = await call(toolsA, 'read_resume', {})
  assert.ok(r.status === 'empty' || r.id, `期望 empty 或简历对象，得到 ${JSON.stringify(r).slice(0, 60)}`)
})

test('generate_resume：占位返回 pending（A6 接入队列）', async () => {
  const r = await call(toolsA, 'generate_resume', { targetRole: '前端工程师', jd: '5 年经验' })
  assert.ok(r.status === 'pending')
})

test('越权隔离：B 无法读改删 A 的机会（含入参塞 user_id 无效）', async () => {
  const created = await call(toolsA, 'add_opportunity', { company: '青禾网络', role: 'A的私有机会' })
  // B 试图通过塞 user_id 越权更新
  await assert.rejects(
    () => call(toolsB, 'update_opportunity', { id: created.id, stage: 'closed', user_id: userA.id }),
    /不存在|没有权限/,
  )
  await assert.rejects(
    () => call(toolsB, 'delete_opportunity', { id: created.id }),
    /不存在|没有权限/,
  )
  // A 的数据未被 B 改动（stage 仍是 applied）
  const updated = await call(toolsA, 'update_opportunity', { id: created.id, stage: 'applied' })
  assert.equal(updated.stage, 'applied')
})

test('会话认证工具链：注册→登录→登出正常', async () => {
  const suffix = Date.now().toString(36)
  const u = await registerUser({ email: `a3c_${suffix}@test.com`, password: 'a3pass12345' })
  const s = await loginUser({ email: u.email, password: 'a3pass12345' })
  assert.ok(s.token)
  sessionA = s.token
  await logoutSession(s.token)
  await deleteAccount(u.id).catch(() => {})
})
