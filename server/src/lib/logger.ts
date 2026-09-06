// pino 结构化日志：请求 ID 贯穿、敏感字段脱敏（cookie/authorization/email 尾部）
import pino from 'pino'
import { pinoHttp } from 'pino-http'

const redactPaths = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  'req.body.password',
  'req.body.email',
  'res.headers["set-cookie"]',
]

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  base: { service: 'greenhouse-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
})

/** Express 请求日志中间件：沿用 requestId 中间件写入的 req.requestId */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const rid = (req.headers['x-request-id'] as string | undefined) || crypto.randomUUID()
    res.setHeader('x-request-id', rid)
    return rid
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
  redact: { paths: redactPaths, censor: '[REDACTED]' },
})
