// Agent 状态定义（A5 完整版：messages + profile + memory + pendingTools + runMeta）
import { Annotation } from '@langchain/langgraph'
import type { BaseMessage } from '@langchain/core/messages'

/** 对话状态：消息累积 + 会话/用户上下文 + 子图工作内存 */
export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  /** 当前会话对应的用户（工具层据此做数据隔离，不信任入参） */
  userId: Annotation<string | undefined>({
    reducer: (_x, y) => y ?? _x,
    default: () => undefined,
  }),
  /** 会话唯一标识（与 conversations 表对齐） */
  conversationId: Annotation<string | undefined>({
    reducer: (_x, y) => y ?? _x,
    default: () => undefined,
  }),
  /** 意图路由结果：strategy | resume | interview | qa | chat */
  intent: Annotation<string | undefined>({
    reducer: (_x, y) => y ?? _x,
    default: () => undefined,
  }),
  /** 用户画像（来自 user_profiles，首轮注入 system prompt 用） */
  profile: Annotation<Record<string, unknown> | undefined>({
    reducer: (_x, y) => y ?? _x,
    default: () => undefined,
  }),
  /** 子图间共享的工作内存（岗位检索结果/推荐清单/评分等） */
  memory: Annotation<Record<string, unknown>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  /** 待用户确认的动作（human-in-loop）：[{action, params}] */
  pendingTools: Annotation<unknown[]>({
    reducer: (_x, y) => y ?? [],
    default: () => [],
  }),
  /** 运行元信息（provider/model/token 用量，A9 计费用） */
  runMeta: Annotation<Record<string, unknown>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
})

export type AgentState = typeof AgentStateAnnotation.State

/** LLM 抽象：mock 与真实 ChatModelClient 都满足（A5 子图/路由可注入） */
export interface ChatModelLike {
  invoke(messages: BaseMessage[], timeoutMsOverride?: number): Promise<{ content: string | unknown; [k: string]: unknown }>
}
