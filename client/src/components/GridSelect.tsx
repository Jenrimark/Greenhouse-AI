import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Globe, Cpu, TrendingUp, MessageCircle, Tv, ShoppingBag, FlaskConical, Factory, Car, Zap, Truck, Building2, GraduationCap, Landmark, Layers } from 'lucide-react'

// 行业图标映射
export const INDUSTRY_ICONS: Record<string, React.ReactNode> = {
  internet: <Globe size={15} />,
  electronics: <Cpu size={15} />,
  finance: <TrendingUp size={15} />,
  consulting: <MessageCircle size={15} />,
  advertising: <Tv size={15} />,
  retail: <ShoppingBag size={15} />,
  healthcare: <FlaskConical size={15} />,
  manufacturing: <Factory size={15} />,
  automotive: <Car size={15} />,
  energy: <Zap size={15} />,
  logistics: <Truck size={15} />,
  realestate: <Building2 size={15} />,
  education: <GraduationCap size={15} />,
  government: <Landmark size={15} />,
}

export interface GridSelectOption {
  value: string
  label: string
  count?: number
  icon?: React.ReactNode
}

interface GridSelectProps {
  value: string
  onChange: (value: string) => void
  options: GridSelectOption[]
  icon?: React.ReactNode
  className?: string
  ariaLabel?: string
}

export function GridSelect({ value, onChange, options, icon, className = '', ariaLabel }: GridSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div className={`gsel ${className}`} ref={ref}>
      <button
        type="button"
        className={`gsel-btn ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label={ariaLabel}
        aria-expanded={open}
      >
        {icon && <span className="gsel-btn-icon">{icon}</span>}
        <span className="gsel-btn-label">
          {selected?.label}
          {selected?.count != null && <span className="gsel-btn-count">{selected.count}</span>}
        </span>
        <ChevronDown size={14} className={`gsel-caret ${open ? 'is-open' : ''}`} />
      </button>

      {open && (
        <div className="gsel-panel" role="listbox">
          <div className="gsel-grid">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`gsel-option ${o.value === value ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
              >
                {o.icon && <span className="gsel-option-icon">{o.icon}</span>}
                <span className="gsel-option-label">{o.label}</span>
                {o.count != null && <span className="gsel-option-count">{o.count}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
