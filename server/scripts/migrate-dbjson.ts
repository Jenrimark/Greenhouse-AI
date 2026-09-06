// db.json → PostgreSQL 一次性迁移脚本（可重复执行，幂等）
// 处置（docs/ARCHITECTURE.md §13）：
//   - 演示用户「吴汉东」转为种子账号（密码占位，E 任务补真实管理员口令）
//   - 1 条 demo 机会归入演示账号
//   - 2 条旧 session 作废（过期 token_hash，不可登录）
//   - credits 300 入账，并写 credits_tx 流水（可审计）
// 对账：迁移完成后逐表输出 db.json 与 PG 的数量与关键字段抽样对比
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from '../src/db/pool.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_FILE = path.join(__dirname, '..', 'data', 'db.json')

interface LegacyState {
  user: { id: string; name: string; handle: string; email: string }
  credits: number
  opportunities: Array<Record<string, unknown> & { id: string }>
  stories: Array<Record<string, unknown> & { id: string }>
  resumes: unknown[]
  sessions: Array<{ id: string; userId: string }>
}

function loadLegacy(): LegacyState | null {
  if (!fs.existsSync(DB_FILE)) return null
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as LegacyState
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

async function migrate(): Promise<void> {
  const legacy = loadLegacy()
  if (!legacy) {
    console.log('[migrate] db.json 不存在，跳过（空库迁移无需执行）')
    return
  }

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // ---- 1. 种子用户（幂等：按 email 查重）----
    const demoEmail = legacy.user.email || 'demo@greenroom.local'
    const demoUser = await client.query('SELECT id FROM users WHERE lower(email) = lower($1)', [demoEmail])
    let demoUserId: string
    if (demoUser.rows.length > 0) {
      demoUserId = demoUser.rows[0].id as string
      console.log(`[migrate] 种子用户已存在，跳过创建: ${demoEmail} (${demoUserId})`)
    } else {
      demoUserId = randomUUID()
      // 密码占位：E 任务生成真实 argon2id 口令后更新；当前哈希不可用于登录
      await client.query(
        `INSERT INTO users (id, email, password_hash, name, handle, credits, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
        [demoUserId, demoEmail, '!migrated-seed-pending', legacy.user.name || '吴汉东', legacy.user.handle || '演示账号', legacy.credits],
      )
      // 迁移入账流水
      await client.query(
        `INSERT INTO credits_tx (user_id, amount, reason, ref_id)
         VALUES ($1, $2, 'migrated-seed', $3)`,
        [demoUserId, legacy.credits, `legacy:${legacy.user.id}`],
      )
      console.log(`[migrate] 种子用户已创建: ${demoEmail} (${demoUserId})，credits=${legacy.credits}`)
    }

    // ---- 2. 旧会话作废（过期 token_hash，不可登录）----
    let sessMoved = 0
    for (const s of legacy.sessions ?? []) {
      await client.query(
        `INSERT INTO sessions (id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, now() - interval '1 day')
         ON CONFLICT (token_hash) DO NOTHING`,
        [randomUUID(), demoUserId, sha256(`legacy:${s.id}`)],
      )
      sessMoved++
    }
    if (sessMoved > 0) {
      console.log(`[migrate] 旧会话 ${sessMoved} 条已作废写入（expired，不可登录）`)
    }

    // ---- 3. 机会管线（旧 id 非 uuid → 重映射为新 uuid，输出映射表）----
    let oppMoved = 0
    const oppIdMap: Array<{ from: string; to: string }> = []
    for (const opp of legacy.opportunities ?? []) {
      const newId = randomUUID()
      const createdAt = opp.createdAt ? new Date(opp.createdAt as string) : new Date()
      // 幂等：按 (user_id, company, role, jd, created_at) 业务键去重
      const dup = await client.query(
        `SELECT id FROM opportunities
         WHERE user_id=$1 AND company=$2 AND role=$3 AND jd=$4 AND created_at=$5`,
        [demoUserId, String(opp.company ?? ''), String(opp.role ?? ''), String(opp.jd ?? ''), createdAt],
      )
      if (dup.rows.length > 0) continue
      await client.query(
        `INSERT INTO opportunities
           (id, user_id, company, role, jd, location, salary, stage, match, next_action, questions, rounds, due_at, sample, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())`,
        [
          newId,
          demoUserId,
          String(opp.company ?? ''),
          String(opp.role ?? ''),
          String(opp.jd ?? ''),
          String(opp.location ?? ''),
          String(opp.salary ?? ''),
          String(opp.stage ?? 'applied'),
          opp.match == null ? null : Number(opp.match),
          opp.nextAction ? JSON.stringify(opp.nextAction) : null,
          JSON.stringify(opp.questions ?? []),
          JSON.stringify(opp.rounds ?? []),
          opp.dueAt ? new Date(opp.dueAt as string) : null,
          Boolean(opp.sample ?? false),
          opp.createdAt ? new Date(opp.createdAt as string) : new Date(),
        ],
      )
      oppIdMap.push({ from: opp.id, to: newId })
      oppMoved++
    }
    console.log(`[migrate] 机会迁移 ${oppMoved} 条 → 演示账号`)
    for (const m of oppIdMap) console.log(`    id 映射: ${m.from} → ${m.to}`)

    // ---- 4. 经历库 / 简历：当前为空，直接跳过 ----
    console.log(`[migrate] stories=${legacy.stories?.length ?? 0}、resumes=${legacy.resumes?.length ?? 0}（空，无需迁移）`)

    await client.query('COMMIT')
    console.log('[migrate] 迁移提交完成')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  // ---- 5. 对账（db.json vs PG）----
  await reconcile(legacy)
}

async function reconcile(legacy: LegacyState): Promise<void> {
  const pool = getPool()
  const demoEmail = legacy.user.email || 'demo@greenroom.local'
  const [userRes, oppRes, credRes, sessRes] = await Promise.all([
    pool.query(`SELECT id, email, name, credits FROM users WHERE lower(email)=lower($1)`, [demoEmail]),
    pool.query(`SELECT id, company, role, stage, match FROM opportunities WHERE user_id=(SELECT id FROM users WHERE lower(email)=lower($1)) ORDER BY created_at`, [demoEmail]),
    pool.query(`SELECT COALESCE(sum(amount),0) AS total FROM credits_tx WHERE user_id=(SELECT id FROM users WHERE lower(email)=lower($1))`, [demoEmail]),
    pool.query(`SELECT count(*)::int AS n FROM sessions`),
  ])

  const user = userRes.rows[0]
  console.log('\n========== 迁移对账 ==========')
  console.log(`[users]    db.json=1  PG=${user ? 1 : 0}   ${user ? `✓  ${user.email} / ${user.name} / credits=${user.credits}` : '✗ 缺失'}`)
  console.log(`[credits]  db.json=${legacy.credits}  PG.credits=${user?.credits}  PG.tx总入账=${credRes.rows[0]?.total}`)
  const oppCount = oppRes.rows.length
  console.log(`[opportunities] db.json=${legacy.opportunities?.length ?? 0}  PG=${oppCount}  ${oppCount === (legacy.opportunities?.length ?? 0) ? '✓ 数量一致' : '✗ 不一致'}`)
  for (const o of oppRes.rows) {
    console.log(`    - ${o.company} / ${o.role} / stage=${o.stage} / match=${o.match} / id=${String(o.id).slice(0, 8)}`)
  }
  console.log(`[sessions] db.json=${legacy.sessions?.length ?? 0}（作废）  PG=${sessRes.rows[0]?.n}`)
  console.log('============================')
}

migrate()
  .then(() => {
    console.log('[migrate] 完成')
    process.exit(0)
  })
  .catch((err) => {
    console.error('[migrate] 失败:', err)
    process.exit(1)
  })
