// A1 验收脚本：最小图执行 / MemorySaver 断点恢复 / 最小 ReAct 工具往返（mock 必跑 + 真实模式若有 key）
// 运行：npm run a1:smoke -w server
import { HumanMessage } from '@langchain/core/messages'
import { createMinimalGraph, createMinimalReAct } from '../src/agent/minimal-react.js'

const results: string[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  // 1. 最小图可执行
  const g1 = createMinimalGraph()
  const r1 = await g1.invoke({ messages: [new HumanMessage('你好')], userId: 'u1' }, { configurable: { thread_id: 't1' } })
  check('最小图可执行', r1.messages.at(-1)?.content === 'echo: 你好', `末条消息="${r1.messages.at(-1)?.content}"`)

  // 2. MemorySaver 断点恢复（同 thread 二次 invoke 上下文延续）
  await g1.invoke({ messages: [new HumanMessage('第二次')] }, { configurable: { thread_id: 't1' } })
  const hist = await g1.getState({ configurable: { thread_id: 't1' } })
  const cnt = hist.values.messages.length
  check('MemorySaver 断点恢复（消息累计）', cnt === 4, `同 thread 累计 ${cnt} 条（2 轮×2）`)

  // 3. mock 模式工具往返：model→tools→model→END
  const { graph: g2 } = createMinimalReAct({ mode: 'mock' })
  const r2 = await g2.invoke(
    { messages: [new HumanMessage('武汉天气如何？')], userId: 'u1' },
    { configurable: { thread_id: 't2' } },
  )
  const trace = r2.messages.map((m) => m.constructor.name).join(' → ')
  const hasToolResult = r2.messages.some((m) => (m as any).name === 'get_weather' || (m as any).content?.includes('多云'))
  check('mock ReAct 工具往返（LLM→工具→LLM）', trace.includes('ToolMessage') && hasToolResult, trace)

  // 4. 真实模式（有 AGENT_API_KEY 时）：真实 ChatOpenAI 跑通 get_weather
  const baseURL = process.env.AGENT_BASE_URL
  const apiKey = process.env.AGENT_API_KEY
  const model = process.env.AGENT_MODEL
  if (baseURL && apiKey && model) {
    const { graph: g3 } = createMinimalReAct({ mode: 'real', baseURL, apiKey, model })
    const r3 = await g3.invoke(
      { messages: [new HumanMessage('武汉今天天气怎么样？')], userId: 'u1' },
      { configurable: { thread_id: 't3' } },
    )
    const last = r3.messages.at(-1) as any
    check('真实 LLM→工具→LLM 往返', !!last?.content && !(last?.tool_calls?.length > 0), `LLM 最终回答: ${String(last?.content).slice(0, 60)}`)
  } else {
    results.push('ℹ️ 未配置 AGENT_BASE_URL/AGENT_API_KEY/AGENT_MODEL，真实模式跳过（A2 完成后可配 key 补跑）')
  }

  console.log('\n=== A1 验收 ===')
  for (const line of results) console.log(line)
  const failed = results.filter((r) => r.startsWith('❌')).length
  if (failed > 0) process.exit(1)
  console.log(`\n通过 ${results.filter((r) => r.startsWith('✅')).length} 项，失败 ${failed} 项`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
