import React from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: React.ReactNode
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  size?: 'sm' | 'md'
  icon?: React.ReactNode
  className?: string
  ariaLabel?: string
  disabled?: boolean
}

/**
 * 下拉选择：.sel（原生 select + 自定义箭头，保证可访问与可用）
 */
export function Select({ value, onChange, options, size = 'md', icon, className = '', ariaLabel, disabled }: SelectProps) {
  return (
    <span className={`sel ${size === 'sm' ? 'sel-sm' : ''} ${className}`}>
      {icon}
      <select
        className="sel-native"
        value={value}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="sel-caret" aria-hidden="true" />
    </span>
  )
}
