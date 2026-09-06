import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'

export interface Me {
  id: string
  name: string
  handle: string
  email: string
  avatarUrl?: string | null
  credits: number
  createdAt?: string
  updatedAt?: string
}

interface AppData {
  me: Me | null
  credits: number
  dueCount: number
  loading: boolean
  refresh: () => void
}

const AppDataContext = createContext<AppData>({
  me: null,
  credits: 0,
  dueCount: 0,
  loading: true,
  refresh: () => {},
})

function toMe(user: any): Me {
  return {
    id: user.id,
    name: user.name,
    handle: user.handle ?? '',
    email: user.email ?? '',
    avatarUrl: user.avatar_url,
    credits: user.credits ?? 0,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  }
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [credits, setCredits] = useState(0)
  const [dueCount, setDueCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all([
      api
        .get<{ data: { user: any } }>('/api/account/me')
        .then((r) => toMe(r.data.user))
        .catch(() => null),
      api
        .get<{ data: { credits: number } }>('/api/account/credits')
        .then((r) => r.data.credits)
        .catch(() => 0),
      api
        .get<{ data: { due: number } }>('/api/opportunities/summary')
        .then((r) => r.data.due ?? 0)
        .catch(() => 0),
    ]).then(([m, c, s]) => {
      if (!alive) return
      setMe(m)
      setCredits(c ?? 0)
      setDueCount(s ?? 0)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [tick])

  return (
    <AppDataContext.Provider
      value={{ me, credits, dueCount, loading, refresh: () => setTick((t) => t + 1) }}
    >
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData() {
  return useContext(AppDataContext)
}
