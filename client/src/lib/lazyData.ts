// 大 JSON 按需加载：静态 import 会把 3.6MB 数据打进首屏 bundle。
// 这里用显式注册表 + 动态 import，让 Vite 将每个 JSON 拆成独立 chunk，进入页面时才加载。
import { useEffect, useState } from 'react'

const loaders: Record<string, () => Promise<{ default: unknown }>> = {
  catalog: () => import('../data/catalog.json'),
  'flow-maps': () => import('../data/flow-maps.json'),
  'flow-node-map': () => import('../data/flow-node-map.json'),
  'interview-focus': () => import('../data/interview-focus.json'),
  'level-focus': () => import('../data/level-focus.json'),
  ladders: () => import('../data/ladders.json'),
  'company-levels': () => import('../data/company-levels.json'),
}

const cache = new Map<string, unknown>()
const inflight = new Map<string, Promise<unknown>>()

export function loadJson<T>(name: string): Promise<T> {
  const hit = cache.get(name)
  if (hit !== undefined) return Promise.resolve(hit as T)
  const running = inflight.get(name)
  if (running) return running as Promise<T>
  const loader = loaders[name]
  if (!loader) return Promise.reject(new Error(`未知数据源: ${name}`))
  const p = loader()
    .then((m) => {
      cache.set(name, m.default)
      return m.default as T
    })
    .finally(() => {
      inflight.delete(name)
    })
  inflight.set(name, p)
  return p
}

/** 组件内按需加载钩子：names 变化时加载对应 JSON，ready 后 data 可用 */
export function useLazyData(names: string[]): { data: Record<string, any>; ready: boolean; error: Error | null; retry: () => void } {
  const [retryToken, setRetryToken] = useState(0)
  const [state, setState] = useState<{ data: Record<string, any>; ready: boolean; error: Error | null }>({
    data: {},
    ready: false,
    error: null,
  })

  useEffect(() => {
    let alive = true
    setState({ data: {}, ready: false, error: null })
    Promise.all(names.map((n) => loadJson<any>(n)))
      .then((vals) => {
        if (!alive) return
        const obj: Record<string, any> = {}
        names.forEach((n, i) => {
          obj[n] = vals[i]
        })
        setState({ data: obj, ready: true, error: null })
      })
      .catch((cause: unknown) => {
        if (!alive) return
        setState({ data: {}, ready: false, error: cause instanceof Error ? cause : new Error(String(cause)) })
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names.join('|'), retryToken])

  return { ...state, retry: () => setRetryToken((token) => token + 1) }
}
