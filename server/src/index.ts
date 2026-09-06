// 服务入口
import { createApp } from './app.js'
import { env } from './config/env.js'
import { db } from './db.js'

// 初始化演示数据（B 任务后移除）
db()

const app = createApp()
app.listen(env.PORT, () => {
  console.log(`\n  Greenhouse 服务已启动`)
  console.log(`  ├─ 环境:   ${env.NODE_ENV}`)
  console.log(`  ├─ API:   http://localhost:${env.PORT}/api`)
  console.log(`  └─ 健康:  http://localhost:${env.PORT}/api/health\n`)
})
