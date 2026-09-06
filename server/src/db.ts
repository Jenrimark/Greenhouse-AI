// 临时 JSON 持久化（阶段 1 B 任务替换为 PostgreSQL；C 任务迁移后归档停用）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

export interface DemoState {
  user: {
    id: string
    name: string
    handle: string
    email: string
  }
  credits: number
  opportunities: Array<Record<string, unknown> & { id: string }>
  stories: Array<Record<string, unknown> & { id: string }>
  resumes: unknown[]
  sessions: Array<{ id: string; userId: string }>
}

export function seedData(): DemoState {
  return {
    user: { id: 'u_demo', name: '吴汉东', handle: '演示账号', email: 'demo@greenroom.local' },
    credits: 300,
    opportunities: [],
    stories: [],
    resumes: [],
    sessions: [{ id: 'demo-session', userId: 'u_demo' }],
  }
}

let cache: DemoState | null = null
let writeTimer: ReturnType<typeof setTimeout> | null = null

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(seedData(), null, 2), 'utf8')
  }
}

export function db(): DemoState {
  if (cache) return cache
  ensureFile()
  try {
    cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as DemoState
  } catch {
    cache = seedData()
  }
  const base = seedData()
  const state = cache as DemoState & Record<string, unknown>
  const baseState = base as DemoState & Record<string, unknown>
  for (const k of Object.keys(base)) {
    if (state[k] === undefined) state[k] = baseState[k]
  }
  return cache
}

export function save(): void {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    ensureFile()
    fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2), 'utf8')
  }, 120)
}

export function resetDb(): DemoState {
  cache = seedData()
  save()
  return cache
}

export function id(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}
