// 服务入口
import { createApp } from './app.js'
import { env } from './config/env.js'
import { startSessionCleanup } from './services/auth.js'
import { logger } from './lib/logger.js'

const app = createApp()

// 过期会话定期清理（每小时）
startSessionCleanup()

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Greenhouse API 已启动')
})
