// 服务入口
import { createApp } from './app.js'
import { env } from './config/env.js'
import { startSessionCleanup } from './services/auth.js'

const app = createApp()

// 过期会话定期清理（每小时）
startSessionCleanup()

app.listen(env.PORT, () => {
  console.log(`\n  Greenhouse 服务已启动`)
  console.log(`  ├─ 环境:   ${env.NODE_ENV}`)
  console.log(`  ├─ API:   http://localhost:${env.PORT}/api`)
  console.log(`  └─ 健康:  http://localhost:${env.PORT}/api/health\n`)
})
