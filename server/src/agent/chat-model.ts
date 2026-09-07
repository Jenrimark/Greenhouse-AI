// A2 模型接入层：统一 OpenAI 兼容接入（豆包方舟 / DeepSeek 可切换）+ 超时/5xx 自动降级
// 密钥只从 env 读取；任何日志不得打印 apiKey
import { ChatOpenAI } from '@langchain/openai'
import type { Runnable } from '@langchain/core/runnables'
import type { BaseMessage, AIMessage } from '@langchain/core/messages'
import { env } from '../config/env.js'

type BoundModel = ChatOpenAI | ReturnType<ChatOpenAI['bindTools']>
type BindableTools = Parameters<ChatOpenAI['bindTools']>[0]

export interface ChatModelConfig {
  /** 供应商标识：doubao | deepseek | 自定义 */
  provider: string
  baseURL: string
  apiKey: string
  model: string
  /** 单次调用超时（毫秒），默认 15000 */
  timeoutMs?: number
}

export interface ChatModelOptions {
  primary: ChatModelConfig
  fallback?: ChatModelConfig
}

function createOpenAI(cfg: ChatModelConfig): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: cfg.apiKey,
    model: cfg.model,
    configuration: { baseURL: cfg.baseURL },
    temperature: 0,
    timeout: cfg.timeoutMs ?? 15000,
    maxRetries: 0, // 降级由本类统一管理，关闭 SDK 内建重试避免叠加
  })
}

/** 可重试错误：5xx / 超时 / 网络中断 */
function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { status?: number; code?: string; name?: string; message?: string }
  if (typeof e.status === 'number' && e.status >= 500) return true
  if (
    e.code === 'ETIMEDOUT' ||
    e.code === 'ECONNRESET' ||
    e.code === 'ECONNREFUSED' ||
    e.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    e.name === 'AbortError' ||
    /timeout|timed ?out/i.test(e.message ?? '')
  ) {
    return true
  }
  return false
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * 带降级的对话模型客户端。
 * invoke：主供应商调用，超时/5xx/网络错误 → 指数退避后切备用供应商重试一次；
 * 备用也失败则抛出最后一次错误。
 * bindTools 返回绑定工具的新实例；降级时对主/备均绑定同一组工具。
 */
export class ChatModelClient {
  private readonly opts: ChatModelOptions
  private tools?: BindableTools

  constructor(opts: ChatModelOptions) {
    this.opts = opts
  }

  get timeoutMs(): number {
    return this.opts.primary.timeoutMs ?? 15000
  }

  bindTools(tools: BindableTools): ChatModelClient {
    const clone = new ChatModelClient(this.opts)
    clone.tools = tools
    return clone
  }

  async invoke(messages: BaseMessage[], timeoutMsOverride?: number): Promise<AIMessage> {
    const primaryTimeout = timeoutMsOverride ?? this.opts.primary.timeoutMs ?? 15000
    const primary = this.llm(this.opts.primary)
    try {
      return await this.call(primary, messages, primaryTimeout)
    } catch (err) {
      if (!this.opts.fallback || !isRetryable(err)) {
        throw err
      }
      // 指数退避（500ms → 1000ms）
      await sleep(500)
      const fbTimeout = this.opts.fallback.timeoutMs ?? 30000
      return await this.call(this.llm(this.opts.fallback), messages, fbTimeout)
    }
  }

  /** 生成最终模型（含工具绑定）；每次调用新建实例，规避并发共享状态 */
  private llm(cfg: ChatModelConfig): BoundModel {
    const m = createOpenAI(cfg)
    return this.tools ? m.bindTools(this.tools) : m
  }

  private async call(model: BoundModel, messages: BaseMessage[], timeoutMs: number): Promise<AIMessage> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      return await model.invoke(messages, { signal: ctrl.signal })
    } finally {
      clearTimeout(timer)
    }
  }
}

/** 从环境变量构建模型客户端（主供应商 + 可选备用） */
export function createChatModelFromEnv(): ChatModelClient {
  const timeoutMs = env.AGENT_TIMEOUT_MS
  const primary: ChatModelConfig = {
    provider: env.AGENT_PROVIDER,
    baseURL: env.AGENT_BASE_URL,
    apiKey: env.AGENT_API_KEY,
    model: env.AGENT_MODEL,
    timeoutMs,
  }
  const hasFallback = !!(env.AGENT_FALLBACK_BASE_URL && env.AGENT_FALLBACK_API_KEY)
  const fallback: ChatModelConfig | undefined = hasFallback
    ? {
        provider: 'fallback',
        baseURL: env.AGENT_FALLBACK_BASE_URL,
        apiKey: env.AGENT_FALLBACK_API_KEY,
        model: env.AGENT_FALLBACK_MODEL || env.AGENT_MODEL,
        timeoutMs: Math.round(timeoutMs * 2),
      }
    : undefined
  return new ChatModelClient({ primary, fallback })
}
