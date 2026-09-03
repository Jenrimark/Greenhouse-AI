// 共享数据类型（与后端 API 对齐）

export type Stage = 'applied' | 'interview' | 'offer' | 'closed'

export interface Round {
  id: string
  kind: 'screen' | 'interview' | 'mock' | 'oa' | 'final'
  title: string
  date?: string
}

export interface Question {
  id: string
  text: string
}

export interface Opportunity {
  id: string
  role: string
  company: string
  stage: Stage
  location?: string
  salary?: string
  match?: number
  jd?: string
  questions?: Question[]
  rounds?: Round[]
  nextAction?: { label?: string; due?: string | null }
  dueAt?: string | null
  sample?: boolean
  createdAt?: string
}

export interface StoryEntry {
  id: string
  title: string
  org?: string
  start?: string
  end?: string
  bullets?: string[]
  tags?: string[]
}

export interface ResumeDoc {
  id: string
  title: string
  kind: 'base' | 'role' | 'lang'
  updatedAt?: string
}
