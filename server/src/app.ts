// Express 应用装配：中间件顺序、路由挂载、统一错误处理
import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { requestId } from './middleware/requestId.js'
import { apiNotFound, errorHandler } from './middleware/error.js'
import { httpLogger } from './lib/logger.js'
import { pingDb } from './db/pool.js'
import { pingRedis } from './redis/client.js'
import { attachUserIfPresent } from './middleware/requireAuth.js'
import authRoutes from './routes/auth.js'
import accountRoutes from './routes/account.js'
import opportunityRoutes from './routes/opportunities.js'
import storyRoutes from './routes/stories.js'
import resumeRoutes from './routes/resumes.js'
import discoverRoutes from './routes/discover.js'
import aiRoutes from './routes/ai.js'
import agentTaskRoutes from './routes/agentTasks.js'
import agentRoutes from './routes/agent.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist')
const CLIENT_PUBLIC = path.join(__dirname, '..', '..', 'client', 'public')

export function createApp(): express.Express {
  const app = express()

  app.disable('x-powered-by')
  app.use(httpLogger)
  app.use(requestId)
  app.use(express.json({ limit: '8mb' }))
  app.use(cookieParser())
  app.use(attachUserIfPresent)

  // 健康检查
  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))
  app.get('/api/health/deps', async (_req, res) => {
    const [pgOk, redisOk] = await Promise.all([pingDb(), pingRedis()])
    res.status(pgOk && redisOk ? 200 : 503).json({ postgres: pgOk ? 'ok' : 'down', redis: redisOk ? 'ok' : 'down' })
  })

  // 业务 API
  app.use('/api/auth', authRoutes)
  app.use('/api/account', accountRoutes)
  app.use('/api/opportunities', opportunityRoutes)
  app.use('/api/stories', storyRoutes)
  app.use('/api/resumes', resumeRoutes)
  app.use('/api/job-search', discoverRoutes)
  app.use('/api/agent', agentRoutes)
  app.use('/api/agent', agentTaskRoutes)
  app.use('/api', aiRoutes)

  // API 404 + 统一错误
  app.use('/api', apiNotFound)
  app.use(errorHandler)

  // 静态资源（art / fonts / assets / 图标）
  app.use(express.static(CLIENT_PUBLIC, { maxAge: '7d' }))

  // 生产环境：托管前端构建产物
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST, { maxAge: '7d' }))
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next()
      res.sendFile(path.join(CLIENT_DIST, 'index.html'))
    })
  }

  return app
}
