// 种子管理员：为迁移的演示账号「吴汉东」(demo@greenroom.local) 设置真实 argon2id 口令
// 用法：ADMIN_SEED_PASSWORD='xxx' npm run seed:admin
//       （不传则生成随机口令并打印一次，安全起见生成后请立即保存）
import argon2 from 'argon2'
import { randomBytes } from 'node:crypto'
import { getPool } from '../src/db/pool.js'

const EMAIL = 'demo@greenroom.local'

async function main(): Promise<void> {
  const password = process.env.ADMIN_SEED_PASSWORD || `GhSeed-${randomBytes(9).toString('base64url')}`
  const hash = await argon2.hash(password, { type: argon2.argon2id })
  const pool = getPool()
  const res = await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = now() WHERE lower(email) = lower($2) RETURNING id, email, name`,
    [hash, EMAIL],
  )
  if (res.rows.length === 0) {
    console.error(`[seed] 用户 ${EMAIL} 不存在，请先执行 migrate:dbjson`)
    process.exit(1)
  }
  console.log(`[seed] 管理员口令已设置: ${res.rows[0].email} / ${res.rows[0].name}`)
  if (!process.env.ADMIN_SEED_PASSWORD) {
    console.log(`[seed] 生成的随机口令（仅显示一次，请立即保存）: ${password}`)
  }
}

main().catch((err) => {
  console.error('[seed] 失败:', err)
  process.exit(1)
})
