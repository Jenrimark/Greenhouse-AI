import React from 'react'

interface EmptyStateProps {
  /** webp 插画（优先） */
  artWebp?: string
  /** png 兜底插画 */
  art?: string
  icon?: React.ReactNode
  title: React.ReactNode
  sub?: React.ReactNode
  action?: React.ReactNode
}

/**
 * 空状态：插画 / 图标 + 标题 + 副文案 + 操作，类名 .gr-empty*
 */
export function EmptyState({ artWebp, art, icon, title, sub, action }: EmptyStateProps) {
  return (
    <div className="gr-empty">
      {artWebp || art ? (
        <picture className="gr-empty-art-wrap">
          {artWebp && <source srcSet={artWebp} type="image/webp" />}
          {art && <img className="gr-empty-art" src={art} alt="" aria-hidden="true" loading="lazy" />}
        </picture>
      ) : icon ? (
        <span className="gr-empty-ico">{icon}</span>
      ) : null}
      <div className="gr-empty-t">{title}</div>
      {sub && <div className="gr-empty-sub">{sub}</div>}
      {action && <div className="gr-empty-act">{action}</div>}
    </div>
  )
}
