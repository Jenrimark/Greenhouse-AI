import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import zh from './zh.json'
import en from './en.json'

// 文案字典：共 2975 条中英对照
const DICTS: Record<string, Record<string, string>> = { zh: zh as any, en: en as any }

export type Lang = 'zh' | 'en'
type Params = Record<string, string | number>

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, params?: Params) => string
}

const I18nContext = createContext<I18nValue>({ lang: 'zh', setLang: () => {}, t: (k) => k })

function readInitialLang(): Lang {
  try {
    const raw = localStorage.getItem('gr_lang')
    if (raw === 'zh' || raw === 'en') return raw
  } catch {
    /* ignore */
  }
  return 'zh'
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? String(params[k]) : m))
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem('gr_lang', l)
    } catch {
      /* ignore */
    }
  }, [])

  const t = useCallback(
    (key: string, params?: Params) => {
      const dict = DICTS[lang] ?? DICTS.zh
      const fallback = DICTS.zh[key] ?? key
      const value = dict[key] ?? fallback
      return interpolate(value, params)
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

// 便捷 hook：只取 t
export function useT() {
  return useContext(I18nContext).t
}
