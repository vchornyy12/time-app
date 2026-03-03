'use client'

import { cn } from '@/lib/utils/cn'

export type Period = '7d' | '30d' | '3m'

const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '3m', label: '3 months' },
]

interface PeriodSelectorProps {
  value: Period
  onChange: (p: Period) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-xl"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60',
            value === p.value
              ? 'bg-indigo-500/20 text-indigo-500 dark:text-indigo-300'
              : ''
          )}
          style={value !== p.value ? { color: 'var(--text-tertiary)' } : undefined}
          onMouseEnter={(e) => {
            if (value !== p.value) e.currentTarget.style.background = 'var(--bg-surface-hover)'
          }}
          onMouseLeave={(e) => {
            if (value !== p.value) e.currentTarget.style.background = ''
          }}
          aria-pressed={value === p.value}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

export function getPeriodFrom(period: Period): Date {
  const d = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  d.setDate(d.getDate() - days)
  return d
}
