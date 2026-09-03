import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'

export interface Me {
  id: string
  name: string
  handle: string
  avatarUrl?: string
  email?: string
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

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [credits, setCredits] = useState(0)
  const [dueCount, setDueCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all([
      api.get<Me>('/api/me').catch(() => null),
      api.get<{ credits: number }>('/api/credits').catch(() => ({ credits: 0 })),
      api.get<{ due: number }>('/api/opportunities/summary').catch(() => ({ due: 0 })),
    ]).then(([m, c, s]) => {
      if (!alive) return
      setMe(m)
      setCredits(c?.credits ?? 0)
      setDueCount(s?.due ?? 0)
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
