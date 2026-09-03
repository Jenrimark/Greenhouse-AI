import React from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger' | 'ai'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  full?: boolean
  icon?: React.ReactNode
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  subtle: 'btn-subtle',
  danger: 'btn-danger',
  ai: 'btn-ai',
}

/**
 * 通用按钮：.btn / .btn-{variant} / .btn-{size}
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  full,
  icon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const cls = ['btn', VARIANT_CLASS[variant], `btn-${size}`, full ? 'btn-full' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button className={cls} {...rest}>
      {icon}
      {children != null && <span className="btn-t">{children}</span>}
    </button>
  )
}
