// A7 Agent runtime：执行编排图 + 消息落库 + 画像抽取 + trace 汇总 + 并发锁
import { randomUUID } from 'node:crypto'
import { HumanMessage } from '@langchain/core/messages'
import { getRedis } from '../redis/client.js'
import { ApiError } from '../middleware/error.js'
import { createOrchestrator } from './orchestrator.js'
import { createChatModelFromEnv } from './chat-model.js'
import { getCheckpointer, threadIdFor } from './checkpointer.js'
import {
  ensureConversation,
  saveMessage,
  upsertProfile,
  extractProfileRuleBased,
  langchainMessageToRows,
} from '../services/agentMemory.js'
import { logger } from '../lib/logger.js'
import { GreenhouseTracer } from './tracer.js'
import { chargeCredits, creditsFromTokens } from '../services/credits.js'
import { getPool } from '../db/pool.js'

export interface AgentChatInput {
  userId: string
  message: string
  conversationId?: string
  /** 显式指定意图（跳过自动路由；如模拟面试页强制 interview） */
  forceIntent?: 'strategy' | 'resume' | 'interview' | 'qa' | 'chat'
}

export interface AgentChatResult {
  reply: string
  conversationId: string
  intent: string
  traceSummary: { runId: string; steps: string[]; durationMs: number }
}

const BUSY_PREFIX = 'agent:busy:'
const BUSY_TTL_MS = 60_000

/** 每用户并发会话上限 1：Redis 锁，占用则 429 */
export async function acquireAgentLock(userId: string): Promise<() => Promise<void>> {
  const redis = getRedis()
  const key = `${BUSY_PREFIX}${userId}`
  const ok = await redis.set(key, '1', 'PX', BUSY_TTL_MS, 'NX')
  if (!ok) throw ApiError.tooMany('你有一个对话正在处理中，请稍候再试')
  return async () => {
    await redis.del(key).catch(() => {})
  }
}

/** 执行一次 Agent 对话（图调用 + 持久化），返回回复与追踪摘要 */
export async function runAgentChat(input: AgentChatInput): Promise<AgentChatResult> {
  const started = Date.now()
  const runId = randomUUID()

  // 1. 会话保障
  const conv = await ensureConversation(
    input.userId,
    input.conversationId,
    input.message.slice(0, 24),
  )

  // 2. 用户消息落库
  await saveMessage({ conversationId: conv.id, role: 'user', content: input.message })

  // 3. 构建图（真实 LLM 需配齐 AGENT_*；否则 mock 模式保证可用性）
  const hasRealLlm = !!(process.env.AGENT_BASE_URL && process.env.AGENT_API_KEY && process.env.AGENT_MODEL)
  const mode = hasRealLlm ? 'real' : 'mock'
  const llm = mode === 'real' ? createChatModelFromEnv() : undefined
  const saver = await getCheckpointer()
  const graph = createOrchestrator({ mode, llm, checkpointer: saver })
  const tracer = new GreenhouseTracer()

  // 4. 执行图
  const thread = threadIdFor(input.userId, conv.id)
  const result = await graph.invoke(
    {
      messages: [new HumanMessage(input.message)],
      userId: input.userId,
      conversationId: conv.id,
      intent: input.forceIntent,
    },
    { configurable: { thread_id: thread }, callbacks: [tracer] },
  )
  const final = result.messages.at(-1)
  const reply =
    typeof final?.content === 'string'
      ? final.content
      : JSON.stringify(final?.content ?? '(无回复)')

  // 5. 助手消息落库（含 tool 消息）
  const newMessages = result.messages.slice(-(result.messages.length > 0 ? 20 : 0))
  for (const m of newMessages) {
    if (m.getType?.() === 'human') continue // 用户消息已单独落库
    const row = langchainMessageToRows(conv.id, m)
    await saveMessage({ conversationId: conv.id, ...row })
  }

  // 6. 画像抽取（规则版兜底；每次增量更新）
  try {
    const history = [...result.messages]
      .filter((m) => m.getType?.() === 'human' || m.getType?.() === 'ai')
      .map((m) => ({ role: m.getType() === 'human' ? 'user' : 'assistant', content: typeof m.content === 'string' ? m.content : '' }))
    const profile = extractProfileRuleBased(history)
    if (profile.targetRoles.length || profile.skills.length || profile.experienceYears !== null) {
      await upsertProfile(input.userId, profile)
    }
  } catch (e) {
    logger.warn({ error: (e as Error).message }, '画像抽取失败（忽略）')
  }

  // 7. trace 落库（每节点/LLM 调用）+ credits 扣费（LLM token → credits，流水可审计）
  const traces = tracer.records.filter((r) => r.runType !== 'tool')
  await persistTraces(input.userId, conv.id, runId, traces)
  const llmUsages = tracer.records.filter((r) => r.runType === 'llm' && r.usage)
  const tokenTotal: { promptTokens?: number; completionTokens?: number } = llmUsages.reduce(
    (acc, r) => {
      acc.promptTokens = (acc.promptTokens ?? 0) + (r.usage?.promptTokens ?? 0)
      acc.completionTokens = (acc.completionTokens ?? 0) + (r.usage?.completionTokens ?? 0)
      return acc
    },
    { promptTokens: 0, completionTokens: 0 } as { promptTokens: number; completionTokens: number },
  )
  const cost = creditsFromTokens(tokenTotal)
  if (cost > 0) {
    await chargeCredits({
      userId: input.userId,
      credits: cost,
      reason: 'agent_llm',
      refId: runId,
    }).catch((e) => {
      // mock 模式无 token 不扣费；真实模式余额不足时已产生对话，记录但不阻断回复
      logger.warn({ runId, error: (e as Error).message }, 'credits 扣费失败（已产生对话）')
    })
  }

  const traceSummary = {
    runId,
    steps: ['intent_router', String(result.intent ?? 'qa')],
    durationMs: Date.now() - started,
    creditsUsed: cost,
  }
  logger.info(
    { runId, userId: input.userId, conversationId: conv.id, intent: result.intent, mode, durationMs: traceSummary.durationMs, creditsUsed: cost },
    'agent chat completed',
  )

  return {
    reply,
    conversationId: conv.id,
    intent: String(result.intent ?? 'qa'),
    traceSummary,
  }
}

/** 把采集到的节点/LLM 轨迹写入 agent_traces（失败不阻断对话，仅告警） */
async function persistTraces(
  userId: string,
  conversationId: string,
  runId: string,
  records: import('./tracer.js').TraceNodeRecord[],
): Promise<void> {
  if (!records.length) return
  const pool = getPool()
  for (const r of records) {
    try {
      await pool.query(
        `INSERT INTO agent_traces
           (run_id, user_id, conversation_id, node, action, input, output, provider, model, prompt_tokens, completion_tokens, cost, duration_ms, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          runId,
          userId,
          conversationId,
          r.name,
          r.runType,
          r.inputs == null ? null : JSON.stringify(r.inputs),
          r.outputs == null ? null : JSON.stringify(r.outputs),
          r.usage?.provider ?? null,
          r.usage?.model ?? null,
          r.usage?.promptTokens ?? null,
          r.usage?.completionTokens ?? null,
          r.usage ? creditsFromTokens(r.usage) : null,
          r.durationMs ?? null,
          r.error ? 'error' : 'ok',
        ],
      )
    } catch (e) {
      logger.warn({ runId, node: r.name, error: (e as Error).message }, 'agent_trace 落库失败')
    }
  }
}
