// 主题与偏好：持久化在 localStorage 的 gr_prefs 中
import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

interface Prefs {
  theme?: ThemeMode
  [k: string]: unknown
}

const PREFS_KEY = 'gr_prefs'

export function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function writePrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...readPrefs(), ...patch }
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export function resolveTheme(mode: ThemeMode | undefined): 'light' | 'dark' {
  const m = mode ?? 'system'
  if (m === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return m
}

export function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', resolved)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0c0f0e' : '#fbfcfb')
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => readPrefs().theme ?? 'system')
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveTheme(readPrefs().theme))

  useEffect(() => {
    const r = resolveTheme(mode)
    setResolved(r)
    applyTheme(r)
    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => applyTheme(resolveTheme('system'))
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
  }, [mode])

  const update = (m: ThemeMode) => {
    writePrefs({ theme: m })
    setMode(m)
  }

  return { mode, resolved, setMode: update, toggle: () => update(resolved === 'dark' ? 'light' : 'dark') }
}
