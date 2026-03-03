'use client'

import { cn } from '@/lib/utils/cn'

interface StatCardProps {
  label: string
  value: string | number
  sublabel?: string
  accent?: 'emerald' | 'indigo' | 'amber' | 'purple'
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps['accent']>, string> = {
  emerald: 'text-emerald-500 dark:text-emerald-300',
  indigo:  'text-indigo-500 dark:text-indigo-300',
  amber:   'text-amber-500 dark:text-amber-300',
  purple:  'text-purple-500 dark:text-purple-300',
}

export function StatCard({ label, value, sublabel, accent }: StatCardProps) {
  return (
    <div className="glass-card p-4 flex flex-col gap-1">
      <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p
        className={cn('text-2xl font-semibold', accent ? ACCENT_CLASSES[accent] : '')}
        style={!accent ? { color: 'var(--text-primary)' } : undefined}
      >
        {value}
      </p>
      {sublabel && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sublabel}</p>}
    </div>
  )
}
