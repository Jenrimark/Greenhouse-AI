// 环境变量统一校验（zod）。所有密钥只从环境读取，不落代码与日志。
import { z } from 'zod'

const boolFromString = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),

  // 数据层（阶段 1 B/D 起使用）
  DATABASE_URL: z.string().default('postgres://localhost:5432/greenhouse'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // 会话
  COOKIE_NAME: z.string().default('gr_session'),
  COOKIE_SECURE: boolFromString,
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // AI 供应商（阶段 2 使用；预留校验，缺失不阻塞阶段 1 启动）
  AGENT_PROVIDER: z.string().default('doubao'),
  AGENT_MODEL: z.string().default(''),
  AGENT_BASE_URL: z.string().default(''),
  AGENT_API_KEY: z.string().default(''),
  AGENT_FALLBACK_MODEL: z.string().default(''),
  AGENT_FALLBACK_BASE_URL: z.string().default(''),
  AGENT_FALLBACK_API_KEY: z.string().default(''),
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`环境变量校验失败: ${detail}`)
  }
  return parsed.data
}

export const env = loadEnv()
