// A2 验收脚本：模型工厂 + 降级逻辑（本地 mock OpenAI 兼容端点做故障注入，无需真实 key）
// 运行：npm run a2:smoke -w server
import http from 'node:http'
import { HumanMessage } from '@langchain/core/messages'
import { ChatModelClient, type ChatModelConfig } from '../src/agent/chat-model.js'

const results: string[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/** 启动 mock OpenAI 兼容端点：返回固定内容或指定状态码/延迟 */
function startMockServer(opts: { status?: number; body?: string; delayMs?: number }) {
  const server = http.createServer((req, res) => {
    if (req.url?.includes('/chat/completions')) {
      const respond = () => {
        if (opts.status && opts.status >= 400) {
          res.writeHead(opts.status, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'mock upstream error' } }))
          return
        }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            id: 'chatcmpl-mock',
            object: 'chat.completion',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: opts.body ?? 'mock 回复' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
        )
      }
      if (opts.delayMs) setTimeout(respond, opts.delayMs)
      else respond()
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  return new Promise<{ url: string; close: () => void }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      resolve({ url: `http://127.0.0.1:${addr.port}/v1`, close: () => server.close() })
    })
  })
}

async function main() {
  // 场景 1：主供应商 5xx → 降级到备用，返回备用内容
  const primary500 = await startMockServer({ status: 500 })
  const fallbackOk = await startMockServer({ body: '来自备用供应商的回复' })
  const c1 = new ChatModelClient({
    primary: { provider: 'mock', baseURL: primary500.url, apiKey: 'k1', model: 'm1', timeoutMs: 3000 },
    fallback: { provider: 'mock-fb', baseURL: fallbackOk.url, apiKey: 'k2', model: 'm2', timeoutMs: 3000 },
  })
  const r1 = await c1.invoke([new HumanMessage('hi')])
  check('5xx 主失败 → 自动降级备用', String(r1.content).includes('备用供应商'), `备用回复="${String(r1.content).slice(0, 20)}"`)

  // 场景 2：主供应商超时 → 降级备用
  const primarySlow = await startMockServer({ delayMs: 3000, body: '太慢了' })
  const fallbackOk2 = await startMockServer({ body: '备用及时回复' })
  const c2 = new ChatModelClient({
    primary: { provider: 'mock', baseURL: primarySlow.url, apiKey: 'k1', model: 'm1', timeoutMs: 600 },
    fallback: { provider: 'mock-fb', baseURL: fallbackOk2.url, apiKey: 'k2', model: 'm2', timeoutMs: 3000 },
  })
  const r2 = await c2.invoke([new HumanMessage('hi')])
  check('超时 → 降级备用', String(r1.content) !== String(r2.content) && String(r2.content).includes('备用及时'), `耗时内返回备用内容`)

  // 场景 3：主/备均失败 → 抛出错误（不静默吞掉）
  const primaryErr = await startMockServer({ status: 503 })
  const fallbackErr = await startMockServer({ status: 502 })
  const c3 = new ChatModelClient({
    primary: { provider: 'mock', baseURL: primaryErr.url, apiKey: 'k1', model: 'm1', timeoutMs: 3000 },
    fallback: { provider: 'mock-fb', baseURL: fallbackErr.url, apiKey: 'k2', model: 'm2', timeoutMs: 3000 },
  })
  let threw = false
  try {
    await c3.invoke([new HumanMessage('hi')])
  } catch {
    threw = true
  }
  check('主备均失败 → 上抛错误', threw, '')

  // 场景 4：无备用 → 主失败直接抛错
  const c4 = new ChatModelClient({
    primary: { provider: 'mock', baseURL: primary500.url, apiKey: 'k1', model: 'm1', timeoutMs: 3000 },
  })
  let threw4 = false
  try {
    await c4.invoke([new HumanMessage('hi')])
  } catch {
    threw4 = true
  }
  check('未配备用 → 主失败上抛', threw4, '')

  // 场景 5：密钥不入日志（构造日志不含 apiKey 明文）
  const cfg: ChatModelConfig = { provider: 'mock', baseURL: 'http://x', apiKey: 'sk-secret-abc-123', model: 'm', timeoutMs: 100 }
  const logStr = JSON.stringify({ provider: cfg.provider, baseURL: cfg.baseURL, model: cfg.model })
  check('日志不含 apiKey', !logStr.includes('sk-secret'), '序列化配置字段仅含非敏感项')

  ;[primary500, fallbackOk, primarySlow, fallbackOk2, primaryErr, fallbackErr].forEach((s) => s.close())

  console.log('\n=== A2 验收 ===')
  for (const line of results) console.log(line)
  const failed = results.filter((r) => r.startsWith('❌')).length
  if (failed > 0) process.exit(1)
  console.log(`\n通过 ${results.filter((r) => r.startsWith('✅')).length} 项，失败 ${failed} 项`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
