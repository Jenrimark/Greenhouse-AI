// Worker 进程预留（阶段 2 A6 接入 bullmq 消费异步任务）。
// 阶段 1：常驻心跳进程，保证镜像/编排结构就位；A6 替换为真正的队列消费者。
import { logger } from '../lib/logger.js'

logger.info({ worker: true }, 'Greenhouse Worker 已启动（阶段 2 A6 接入 bullmq）')

// 常驻心跳
setInterval(() => {
  logger.info({ worker: true, ts: Date.now() }, 'worker heartbeat')
}, 60_000)

// 优雅退出
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    logger.info({ sig }, 'worker 退出')
    process.exit(0)
  })
}
