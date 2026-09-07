// A5 主编排图：intent_router → 条件路由 → 4 个子图之一（子图以函数节点运行）
import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph'
import { AIMessage } from '@langchain/core/messages'
import { AgentStateAnnotation, type AgentState, type ChatModelLike } from './state.js'
import { createMockIntentRouter, createIntentRouter, classifyIntentRuleBased } from './intent-router.js'
import { createStrategySubgraph, createResumeSubgraph, createInterviewSubgraph, createQaSubgraph } from './subgraphs.js'

export interface OrchestratorOptions {
  /** mock：规则意图路由 + 规则化子图节点（无需 API key）；real：LLM 路由 + 真实 LLM 子图 */
  mode: 'mock' | 'real'
  llm?: ChatModelLike
  checkpointer?: unknown
}

/** 把子图包装为主图函数节点（子图独立 compile + invoke，输出并入主状态）
 *  注：langgraph 的 StateGraph 泛型编码了节点名，不同子图类型互不兼容，此处用结构化边界。 */
function wrapSubgraph(sub: unknown) {
  const compiled = (sub as { compile: (c: { checkpointer: unknown }) => unknown }).compile({
    checkpointer: new MemorySaver(),
  })
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const thread = `${state.userId ?? 'anon'}:${state.conversationId ?? 'sub'}`
    const out = (await (compiled as { invoke: (s: unknown, o: unknown) => Promise<unknown> }).invoke(
      state,
      { configurable: { thread_id: thread } },
    )) as Partial<AgentState>
    const { messages, memory, profile, pendingTools } = out
    return { messages, memory, profile, pendingTools }
  }
}

/** 构建主编排图（编译后返回；checkpointer 缺省 MemorySaver） */
export function createOrchestrator(opts: OrchestratorOptions) {
  const { mode } = opts
  const routerNode = mode === 'mock' ? createMockIntentRouter() : createIntentRouter(opts.llm!)
  const llm = opts.llm ?? (mockLlm() as unknown as ChatModelLike)

  const graph = new StateGraph(AgentStateAnnotation)
    .addNode('intent_router', routerNode)
    .addNode('strategy', wrapSubgraph(createStrategySubgraph(llm)))
    .addNode('resume', wrapSubgraph(createResumeSubgraph(llm)))
    .addNode('interview', wrapSubgraph(createInterviewSubgraph(llm)))
    .addNode('qa', wrapSubgraph(createQaSubgraph(llm)))
    .addNode('chat', async (state: AgentState) => {
      const lastUser = [...state.messages].reverse().find((m) => m.getType?.() === 'human')
      const text = typeof lastUser?.content === 'string' ? lastUser.content : ''
      const reply = /你好|嗨|hello|hi|在吗/i.test(text)
        ? '你好！我是 Greenhouse 求职助手，可以帮你制定求职策略、优化简历、模拟面试，或回答求职相关问题。'
        : '不客气！有求职问题随时找我。'
      return { messages: [new AIMessage(reply)] }
    })
    .addEdge(START, 'intent_router')
    .addConditionalEdges('intent_router', (state: AgentState) => state.intent ?? 'qa')
    .addEdge('strategy', END)
    .addEdge('resume', END)
    .addEdge('interview', END)
    .addEdge('qa', END)
    .addEdge('chat', END)
    .compile({ checkpointer: (opts.checkpointer ?? undefined) as never })

  return graph
}

/** mock LLM：按 system prompt 关键字返回对应内容（验收用；真实模式传 ChatModelClient） */
export function mockLlm() {
  return {
    async invoke(messages: Array<{ getType: () => string; content: unknown }>) {
      const system = messages.find((m) => m.getType() === 'system')?.content ?? ''
      const human = messages.find((m) => m.getType() === 'human')?.content ?? ''
      const s = String(system)
      const h = String(human)
      let content = '（mock）已收到你的问题。'
      if (s.includes('意图路由器')) content = classifyIntentRuleBased(h)
      else if (s.includes('资深 HR')) content = '要求：扎实的计算机基础、相关项目经验、良好的沟通协作。'
      else if (s.includes('资深面试官')) content = '结构：回答逻辑清晰（35/40），亮点：有量化结果（30/30），改进：可补充团队协作细节（25/30）。总分 90。'
      else content = `（mock 回答）关于「${h.slice(0, 20)}」，建议：先梳理你的项目亮点，再对照岗位要求逐条匹配。`
      return { content }
    },
  }
}
