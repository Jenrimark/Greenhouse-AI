// 极简 JSON 文件持久化：读写 server/data/db.json，进程内缓存 + 落盘
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

export function seedData() {
  return {
    // 当前会话用户（演示账号）
    user: {
      id: 'u_demo',
      name: '吴汉东',
      handle: '演示账号',
      email: 'demo@greenroom.local',
    },
    credits: 300,
    // 机会管线：默认空，与新账号一致；通过「添加岗位」写入
    opportunities: [],
    // 经历库
    stories: [],
    // 简历文档
    resumes: [],
    // 会话
    sessions: [{ id: 'demo-session', userId: 'u_demo' }],
  }
}

let cache = null
let writeTimer = null

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(seedData(), null, 2), 'utf8')
  }
}

export function db() {
  if (cache) return cache
  ensureFile()
  try {
    cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  } catch {
    cache = seedData()
  }
  // 补齐缺失的顶层字段
  const base = seedData()
  for (const k of Object.keys(base)) if (cache[k] === undefined) cache[k] = base[k]
  return cache
}

// 防抖落盘，避免高频写
export function save() {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    ensureFile()
    fs.writeFile(DB_FILE, JSON.stringify(cache, null, 2), (err) => {
      if (err) console.error('[db] 写入失败:', err.message)
    })
  }, 120)
}

export function resetDb() {
  cache = seedData()
  save()
  return cache
}

export function id(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}
