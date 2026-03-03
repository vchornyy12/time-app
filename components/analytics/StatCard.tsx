'use client'

import { cn } from '@/lib/utils/cn'

interface StatCardProps {
  label: string
  value: string | number
  sublabel?: string
  accent?: 'emerald' | 'indigo' | 'amber' | 'purple'
}

const ACCENT_CLS: Record<NonNullable<StatCardProps['accent']>, string> = {
  emerald: 'text-emerald-300',
  indigo: 'text-indigo-300',
  amber: 'text-amber-300',
  purple: 'text-purple-300',
}

export function StatCard({ label, value, sublabel, accent }: StatCardProps) {
  return (
    <div className="glass-card p-4 flex flex-col gap-1">
      <p className="text-xs text-white/35 uppercase tracking-wider">{label}</p>
      <p className={cn('text-2xl font-semibold', accent ? ACCENT_CLS[accent] : 'text-white')}>
        {value}
      </p>
      {sublabel && <p className="text-xs text-white/30 mt-0.5">{sublabel}</p>}
    </div>
  )
}
