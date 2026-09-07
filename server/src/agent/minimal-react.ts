// A1 最小 ReAct 图：LLM 节点 ⇄ 工具节点循环，验证「LLM→工具→LLM」往返
// 两种模式：
//  - mock：LLM 节点为桩（首轮返回 tool_calls，次轮返回最终文本），无需 API key 即可验证图执行与工具往返
//  - real：真实 ChatOpenAI（OpenAI 兼容端点）+ 假工具 get_weather
import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { ChatOpenAI } from '@langchain/openai'
import { AIMessage, type BaseMessage } from '@langchain/core/messages'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { AgentStateAnnotation, type AgentState } from './state.js'

/** 假工具：验证工具往返（A3 替换为真实业务工具） */
const getWeather = tool(
  async ({ city }: { city: string }) => {
    return `「${city}」今日多云，18~26℃，适合面试。`
  },
  {
    name: 'get_weather',
    description: '查询某城市今日天气（演示工具）',
    schema: z.object({ city: z.string().describe('城市名') }),
  },
)

const WEATHER_TOOLS = [getWeather]

/** mock LLM 节点：首轮请求 get_weather，工具结果回来后给出最终回答 */
async function mockModelNode(state: AgentState): Promise<Partial<AgentState>> {
  const last = state.messages.at(-1)
  if (last?.constructor.name === 'ToolMessage') {
    // 工具结果已回来 → 输出最终回答
    return {
      messages: [
        new AIMessage(
          '（mock LLM）已通过 get_weather 工具查到天气，回答完成。',
        ),
      ],
    }
  }
  // 首轮 → 请求调用工具（tool_call id 必须每次唯一：ToolNode 会过滤历史已消费的 id）
  return {
    messages: [
      new AIMessage({
        content: '',
        tool_calls: [{ name: 'get_weather', args: { city: '武汉' }, id: crypto.randomUUID() }],
      }),
    ],
  }
}

/** 真实 LLM 节点 */
function createRealModelNode(baseURL: string, apiKey: string, model: string) {
  const llm = new ChatOpenAI({
    apiKey,
    model,
    configuration: { baseURL },
    temperature: 0,
  }).bindTools(WEATHER_TOOLS)
  return async (state: AgentState): Promise<Partial<AgentState>> => {
    const res = await llm.invoke(state.messages)
    return { messages: [res] }
  }
}

export interface MinimalReActOptions {
  mode: 'mock' | 'real'
  baseURL?: string
  apiKey?: string
  model?: string
  /** 自定义 checkpointer（A4 起传 PostgresSaver；默认 MemorySaver） */
  checkpointer?: unknown
}

/** 构建最小 ReAct 图（编译后返回） */
export function createMinimalReAct(opts: MinimalReActOptions) {
  const modelNode =
    opts.mode === 'real'
      ? createRealModelNode(opts.baseURL!, opts.apiKey!, opts.model ?? 'gpt-4o-mini')
      : mockModelNode

  const toolNode = new ToolNode(WEATHER_TOOLS)

  const graph = new StateGraph(AgentStateAnnotation)
    .addNode('model', modelNode)
    .addNode('tools', toolNode)
    .addEdge(START, 'model')
    .addConditionalEdges('model', (state) => {
      const last = state.messages.at(-1)
      if (last instanceof AIMessage && Array.isArray(last.tool_calls) && last.tool_calls.length > 0) {
        return 'tools'
      }
      return END
    })
    .addEdge('tools', 'model')
    .compile({ checkpointer: (opts.checkpointer ?? new MemorySaver()) as never })

  return { graph, tools: WEATHER_TOOLS }
}

/** 最小 1 节点图 + MemorySaver（验收：可执行、断点可恢复） */
export function createMinimalGraph() {
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode('echo', async (state: AgentState) => ({
      messages: [new AIMessage(`echo: ${state.messages.at(-1)?.content ?? '(空)'}`)],
    }))
    .addEdge(START, 'echo')
    .addEdge('echo', END)
    .compile({ checkpointer: new MemorySaver() })

  return graph
}

export type ReActGraph = ReturnType<typeof createMinimalReAct>['graph']
export type { BaseMessage }
