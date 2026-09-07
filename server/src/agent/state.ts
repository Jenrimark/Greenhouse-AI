// Agent 状态定义（A1 最小版；A5 扩展为 orchestrator + 子图完整状态）
import { Annotation } from '@langchain/langgraph'
import type { BaseMessage } from '@langchain/core/messages'

/** 对话状态：消息累积 + 会话元信息 */
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
  /** 会话唯一标识（A4 与 conversations 表对齐） */
  conversationId: Annotation<string | undefined>({
    reducer: (_x, y) => y ?? _x,
    default: () => undefined,
  }),
})

export type AgentState = typeof AgentStateAnnotation.State
