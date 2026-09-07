// Agent 前端客户端：对话 / 会话 / 异步任务
import { api } from './api'

export interface AgentChatResp {
  reply: string
  conversationId: string
  intent: string
  traceSummary: { runId: string; steps: string[]; durationMs: number }
}

export interface ConversationItem {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
}

export interface HistoryMessage {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string | null
  createdAt: string
}

export async function agentChat(message: string, conversationId?: string, forceIntent?: AgentChatResp['intent']): Promise<AgentChatResp> {
  const r = await api.post<{ data: AgentChatResp }>('/api/agent/chat', { message, conversationId, forceIntent })
  return r.data
}

export async function listConversations(): Promise<ConversationItem[]> {
  const r = await api.get<{ data: { items: ConversationItem[] } }>('/api/agent/conversations')
  return r.data.items ?? []
}

export async function getConversationMessages(conversationId: string): Promise<HistoryMessage[]> {
  const r = await api.get<{ data: { items: HistoryMessage[] } }>(`/api/agent/conversations/${conversationId}/messages`)
  return r.data.items ?? []
}

export interface AgentTaskInfo {
  id: string
  type: string
  status: 'pending' | 'running' | 'done' | 'failed'
  output: { resumeId?: string; title?: string; summary?: string } | null
  error: string | null
  updatedAt: string
}

export async function generateResume(targetRole: string, jd?: string): Promise<{ taskId: string }> {
  const r = await api.post<{ data: { taskId: string } }>('/api/agent/resume/generate', { targetRole, jd })
  return r.data
}

export async function getAgentTask(taskId: string): Promise<AgentTaskInfo> {
  const r = await api.get<{ data: AgentTaskInfo }>(`/api/agent/tasks/${taskId}`)
  return r.data
}

/** 轮询任务直至终态（done/failed），超时 60s */
export async function pollTask(taskId: string, onTick?: (t: AgentTaskInfo) => void, timeoutMs = 60_000): Promise<AgentTaskInfo> {
  const started = Date.now()
  for (;;) {
    const t = await getAgentTask(taskId)
    onTick?.(t)
    if (t.status === 'done' || t.status === 'failed') return t
    if (Date.now() - started > timeoutMs) throw new Error('任务超时，请稍后在简历页查看')
    await new Promise((r) => setTimeout(r, 1500))
  }
}
