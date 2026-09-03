import { useMemo } from 'react'

// 确定性字符串哈希（FNV-1a）
function hash(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 像素小人：由种子确定性生成（对称 9x11 网格）
const SKIN = ['#f2c9a0', '#e8b488', '#d99a6c', '#c98a5b', '#a96841', '#8a5236']
const HAIR = ['#2f2a26', '#4a3527', '#6b4a2f', '#1f2937', '#5b3a8a', '#0f766e', '#9a3412', '#b45309']
const TOP = ['#15895d', '#0e7490', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#475569']
const BG = ['#eaf5ef', '#e7f1f5', '#eef0fb', '#f6ecf7', '#fdeef3', '#fdf1e7', '#fbf6e3', '#eef1f4']

export function PixelAvatar({ seed, size = 40, className = '' }: { seed: string; size?: number; className?: string }) {
  const { cells, skin, hair, top, bg } = useMemo(() => {
    const rnd = mulberry32(hash(seed || 'role'))
    const skin = SKIN[Math.floor(rnd() * SKIN.length)]
    const hair = HAIR[Math.floor(rnd() * HAIR.length)]
    const top = TOP[Math.floor(rnd() * TOP.length)]
    const bg = BG[Math.floor(rnd() * BG.length)]
    // 9 列 x 11 行，左右对称
    const W = 9
    const H = 11
    const grid: number[][] = Array.from({ length: H }, () => Array(W).fill(0))
    const pick = (p: number) => (rnd() < p ? 1 : 0)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < Math.ceil(W / 2); x++) {
        let v = 0
        if (y >= 1 && y <= 3) v = pick(0.85) // 头发
        else if (y >= 4 && y <= 6) v = 1 // 脸
        else if (y === 7) v = pick(0.5) // 下巴/颈
        else if (y >= 8) v = 1 // 上衣
        grid[y][x] = v
        grid[y][W - 1 - x] = v
      }
    }
    // 眼睛
    grid[5][2] = 2
    grid[5][6] = 2
    return { cells: grid, skin, hair, top, bg }
  }, [seed])

  const colorFor = (v: number) => (v === 2 ? '#233029' : v === 0 ? 'transparent' : null)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 9 11"
      className={`pixel-av ${className}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ background: bg, borderRadius: '22%' }}
    >
      {cells.map((row, y) =>
        row.map((v, x) => {
          if (v === 0) return null
          let fill = colorFor(v)
          if (fill === null) {
            if (y <= 3) fill = hair
            else if (y <= 7) fill = skin
            else fill = top
          }
          return <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill!} />
        }),
      )}
    </svg>
  )
}
