'use client'

import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  inbox: 'rgba(99,102,241,0.75)',
  next_actions: 'rgba(52,211,153,0.75)',
  waiting_for: 'rgba(251,191,36,0.75)',
  calendar: 'rgba(59,130,246,0.75)',
  someday_maybe: 'rgba(167,139,250,0.75)',
  notes: 'rgba(148,163,184,0.55)',
  done: 'rgba(34,197,94,0.55)',
  trash: 'rgba(239,68,68,0.40)',
}

const STATUS_LABELS: Record<string, string> = {
  inbox: 'Inbox',
  next_actions: 'Next Actions',
  waiting_for: 'Waiting For',
  calendar: 'Calendar',
  someday_maybe: 'Someday',
  notes: 'Notes',
  done: 'Done',
  trash: 'Trash',
}

interface StatusDistributionProps {
  counts: Record<string, number>
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-xl"
      style={{
        background: 'var(--tooltip-bg)',
        border: '1px solid var(--tooltip-border)',
      }}
    >
      <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>{entry.name}</p>
      <p className="mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{entry.value} tasks</p>
    </div>
  )
}

export function StatusDistribution({ counts }: StatusDistributionProps) {
  const data = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: STATUS_LABELS[key] ?? key,
      value,
      color: STATUS_COLORS[key] ?? 'rgba(128,128,128,0.4)',
    }))

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No tasks yet
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-40 h-40 flex-shrink-0" role="img" aria-label="Task status distribution donut chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={62}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 flex flex-col gap-1.5">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="flex-1" style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
            <span className="tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
