// 共享领域类型 + Agent 预留类型（阶段 2 AgentState 基础）
import type { Request } from 'express'

// ---- 业务实体（PostgreSQL 表结构对应，见 docs/ARCHITECTURE.md §7）----

export interface User {
  id: string
  email: string
  password_hash: string
  name: string
  handle: string
  avatar_url: string | null
  wx_openid: string | null
  credits: number
  status: 'active' | 'disabled'
  created_at: Date
  updated_at: Date
}

/** 对外返回的脱敏用户信息（绝不包含 password_hash） */
export type PublicUser = Omit<User, 'password_hash' | 'wx_openid' | 'status'>

export interface Session {
  id: string
  user_id: string
  token_hash: string
  ip: string | null
  user_agent: string | null
  expires_at: Date
  created_at: Date
}

export interface Opportunity {
  id: string
  user_id: string
  company: string
  role: string
  jd: string
  location: string
  salary: string
  stage: string
  match: number | null
  next_action: Record<string, unknown> | null
  questions: unknown[]
  rounds: unknown[]
  due_at: string | null
  sample: boolean
  created_at: string
  updated_at: string
}

export interface Story {
  id: string
  user_id: string
  title: string
  org: string
  start: string
  end: string
  bullets: string[]
  tags: string[]
  created_at: string
}

export interface Resume {
  id: string
  user_id: string
  title: string
  template_id: string
  content: Record<string, unknown>
  file_url: string | null
  created_at: string
  updated_at: string
}

export interface CreditsTx {
  id: string
  user_id: string
  amount: number
  reason: string
  ref_id: string | null
  created_at: string
}

// ---- 统一错误响应 ----

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

// ---- Agent 预留类型（阶段 2：A5 AgentState 基础，先落位避免二次迁移）----

export type AgentRole = 'user' | 'assistant' | 'tool' | 'system'

export interface AgentMessage {
  id?: string
  role: AgentRole
  content: string
  tool_calls?: unknown
  tool_results?: unknown
  createdAt?: string
}

export interface UserProfile {
  user_id: string
  target_roles: string[]
  skills: string[]
  experience_years: number | null
  preferences: Record<string, unknown>
  raw: Record<string, unknown>
  updated_at: string
}

/**
 * AgentState 基础形态（阶段 2 图状态）。
 * 阶段 1 先定义类型，供 conversations/messages/agent_traces 相关代码引用。
 */
export interface AgentState {
  messages: AgentMessage[]
  profile: UserProfile | null
  memory: Record<string, unknown>
  pendingTools: unknown[]
  runMeta: {
    runId: string
    conversationId: string | null
    userId: string
    provider: string
    model: string
  }
}

// ---- Express 请求扩展（认证中间件写入 req.user）----

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser
      requestId?: string
    }
  }
}

// 防止该文件被当作纯类型文件而忽略全局声明
export type _ExpressAugment = Request
