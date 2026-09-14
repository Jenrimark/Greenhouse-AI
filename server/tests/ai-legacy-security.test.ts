// 旧 AI 占位接口的 HTTP 安全与未实现契约测试
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import { createApp } from '../src/app.js'

let server: Server
let base: string

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const address = server.address() as { port: number }
  base = `http://127.0.0.1:${address.port}`
})

after(() => {
  server.closeAllConnections?.()
  server.close()
})

async function request(path: string, method = 'POST') {
  const response = await fetch(`${base}${path}`, { method })
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Ignore non-JSON responses; assertions below require JSON for implemented routes.
  }
  return { status: response.status, body }
}

describe('旧 AI 接口', () => {
  test('未登录访问旧接口统一返回 401', async () => {
    for (const path of ['/api/agent', '/api/answer', '/api/gen', '/api/transcribe', '/api/vision', '/api/resume-vision']) {
      const result = await request(path)
      assert.equal(result.status, 401, path)
    }
    const referral = await request('/api/referral', 'GET')
    assert.equal(referral.status, 401)
  })
})
