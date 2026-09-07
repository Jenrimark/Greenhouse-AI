// A4 记忆服务：conversations / messages / user_profiles 读写
// 消息落库由 runtime（A7）在每轮 invoke 后调用；画像抽取首轮对话后执行。
import { randomUUID } from 'node:crypto'
import { getPool } from '../db/pool.js'
import { ApiError } from '../middleware/error.js'
import type { BaseMessage } from '@langchain/core/messages'

export interface ConversationRow {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
}

export interface MessageRow {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string | null
  toolCalls: unknown[] | null
  toolResults: unknown[] | null
  createdAt: string
}

export interface UserProfile {
  targetRoles: string[]
  skills: string[]
  experienceYears: number | null
  preferences: Record<string, unknown>
}

// ---------- conversations ----------

/** 取会话（校验归属）；不存在返回 null */
export async function getConversation(userId: string, conversationId: string): Promise<ConversationRow | null> {
  const pool = getPool()
  const res = await pool.query(
    'SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1 AND user_id = $2',
    [conversationId, userId],
  )
  const r = res.rows[0]
  if (!r) return null
  return {
    id: r.id,
    title: r.title,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }
}

/** 确保会话存在：有则返回，无则创建（title 可选） */
export async function ensureConversation(
  userId: string,
  conversationId?: string,
  title?: string,
): Promise<ConversationRow> {
  const pool = getPool()
  const id = conversationId ?? randomUUID()
  const existing = await getConversation(userId, id)
  if (existing) return existing
  await pool.query('INSERT INTO conversations (id, user_id, title) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [
    id,
    userId,
    title ?? null,
  ])
  return (await getConversation(userId, id))!
}

/** 列出用户会话（按更新时间倒序） */
export async function listConversations(userId: string): Promise<ConversationRow[]> {
  const pool = getPool()
  const res = await pool.query(
    'SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100',
    [userId],
  )
  return res.rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }))
}

// ---------- messages ----------

export interface SaveMessageInput {
  conversationId: string
  role: MessageRow['role']
  content?: string | null
  toolCalls?: unknown[] | null
  toolResults?: unknown[] | null
}

/** 写一条消息；同时刷新会话 updated_at */
export async function saveMessage(input: SaveMessageInput): Promise<MessageRow> {
  const pool = getPool()
  const res = await pool.query(
    `INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_results)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, conversation_id, role, content, tool_calls, tool_results, created_at`,
    [
      randomUUID(),
      input.conversationId,
      input.role,
      input.content ?? null,
      input.toolCalls ? JSON.stringify(input.toolCalls) : null,
      input.toolResults ? JSON.stringify(input.toolResults) : null,
    ],
  )
  await pool.query('UPDATE conversations SET updated_at = now() WHERE id = $1', [input.conversationId])
  const r = res.rows[0]
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    toolCalls: r.tool_calls,
    toolResults: r.tool_results,
    createdAt: new Date(r.created_at).toISOString(),
  }
}

/** 读会话消息（校验归属） */
export async function listMessages(userId: string, conversationId: string): Promise<MessageRow[]> {
  const conv = await getConversation(userId, conversationId)
  if (!conv) throw ApiError.notFound('会话不存在')
  const pool = getPool()
  const res = await pool.query(
    'SELECT id, conversation_id, role, content, tool_calls, tool_results, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId],
  )
  return res.rows.map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    toolCalls: r.tool_calls,
    toolResults: r.tool_results,
    createdAt: new Date(r.created_at).toISOString(),
  }))
}

/** 将 LangChain 消息序列化为可入库形态 */
export function langchainMessageToRows(
  conversationId: string,
  msg: BaseMessage,
): { role: MessageRow['role']; content: string | null; toolCalls: unknown[] | null; toolResults: unknown[] | null } {
  const role = (msg.getType() === 'human' ? 'user' : msg.getType() === 'ai' ? 'assistant' : msg.getType()) as MessageRow['role']
  const tc = (msg as unknown as { tool_calls?: unknown[] }).tool_calls
  const toolCalls = Array.isArray(tc) && tc.length ? tc : null
  const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
  return { role, content: content || null, toolCalls, toolResults: null }
}

// ---------- user_profiles ----------

/** 读用户画像；无则返回 null */
export async function getProfile(userId: string): Promise<UserProfile | null> {
  const pool = getPool()
  const res = await pool.query(
    'SELECT target_roles, skills, experience_years, preferences, raw FROM user_profiles WHERE user_id = $1',
    [userId],
  )
  const r = res.rows[0]
  if (!r) return null
  return {
    targetRoles: r.target_roles ?? [],
    skills: r.skills ?? [],
    experienceYears: r.experience_years ?? null,
    preferences: r.preferences ?? {},
  }
}

/** 写画像（upsert） */
export async function upsertProfile(userId: string, profile: UserProfile): Promise<UserProfile> {
  const pool = getPool()
  await pool.query(
    `INSERT INTO user_profiles (user_id, target_roles, skills, experience_years, preferences)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       target_roles = EXCLUDED.target_roles,
       skills = EXCLUDED.skills,
       experience_years = EXCLUDED.experience_years,
       preferences = EXCLUDED.preferences,
       updated_at = now()`,
    [
      userId,
      JSON.stringify(profile.targetRoles),
      JSON.stringify(profile.skills),
      profile.experienceYears ?? null,
      JSON.stringify(profile.preferences),
    ],
  )
  return (await getProfile(userId))!
}

// ---------- 画像抽取（规则版兜底；LLM 版 A7 接入后优先） ----------

const ROLE_KEYWORDS = ['前端', '后端', '算法', '测试', '运维', '产品', '设计', '数据分析', '机器学习', 'DevOps', 'SRE', '全栈', '客户端', 'iOS', 'Android', 'Java', 'Go', 'Python', 'Node', 'C++', '架构']
const SKILL_KEYWORDS = ['React', 'Vue', 'TypeScript', 'JavaScript', 'Kubernetes', 'Docker', 'PostgreSQL', 'Redis', 'Node.js', 'LangChain', 'AI', '大模型', '微服务', '云原生', 'Java', 'Go', 'Python']

/** 规则抽取：从用户消息提取目标岗位/技能/经验（无 LLM 可用时兜底；LLM 版在 A7 接入） */
export function extractProfileRuleBased(messages: { role: string; content: string }[]): UserProfile {
  const text = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content ?? '')
    .join('\n')
  const foundRoles = ROLE_KEYWORDS.filter((k) => text.includes(k))
  const foundSkills = SKILL_KEYWORDS.filter((k) => text.includes(k))
  // 经验年数：匹配 "N 年" / "N年经验"
  const yearsMatch = text.match(/(\d{1,2})\s*年(?:经验|经验以上|以上)?/)
  const years = yearsMatch ? Math.min(parseInt(yearsMatch[1] ?? '0', 10), 50) : null
  return {
    targetRoles: foundRoles.length ? [...new Set(foundRoles)] : [],
    skills: foundSkills.length ? [...new Set(foundSkills)] : [],
    experienceYears: years,
    preferences: {},
  }
}
