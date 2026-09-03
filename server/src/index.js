import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { attachUser } from './middleware.js'
import authRoutes from './routes/auth.js'
import accountRoutes from './routes/account.js'
import opportunityRoutes from './routes/opportunities.js'
import storyRoutes from './routes/stories.js'
import discoverRoutes from './routes/discover.js'
import aiRoutes from './routes/ai.js'
import { db } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist')
const CLIENT_PUBLIC = path.join(__dirname, '..', '..', 'client', 'public')
const PORT = process.env.PORT || 8787

const app = express()
app.use(express.json({ limit: '8mb' }))
app.use(cookieParser())
app.use(attachUser)

// 健康检查
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }))

// 业务 API
app.use('/api/auth', authRoutes)
app.use('/api', accountRoutes)
app.use('/api/opportunities', opportunityRoutes)
app.use('/api/stories', storyRoutes)
app.use('/api/job-search', discoverRoutes)
app.use('/api', aiRoutes)

// API 404
app.use('/api', (req, res) => res.status(404).json({ error: `接口不存在: ${req.path}` }))

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

// 初始化数据
db()

app.listen(PORT, () => {
  console.log(`\n  Greenhouse 服务已启动`)
  console.log(`  ├─ API:   http://localhost:${PORT}/api`)
  console.log(`  └─ 前端构建产物: ${fs.existsSync(CLIENT_DIST) ? `http://localhost:${PORT}` : '请先运行 npm run build（开发时用 5173 端口）'}\n`)
})
