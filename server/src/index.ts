// 服务入口
import { createApp } from './app.js'
import { env } from './config/env.js'
import { startSessionCleanup } from './services/auth.js'
import { logger } from './lib/logger.js'

// Sentry 初始化（配置 SENTRY_DSN 后启用，用于捕获未处理异常）
if (env.SENTRY_DSN) {
  const Sentry = await import('@sentry/node')
  Sentry.init({ dsn: env.SENTRY_DSN, tracesSampleRate: 0.1 })
  logger.info({ dsn: env.SENTRY_DSN.slice(0, 20) + '…' }, 'Sentry 已启用')
}

const app = createApp()

// 过期会话定期清理（每小时）
startSessionCleanup()

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Greenhouse API 已启动')
})
