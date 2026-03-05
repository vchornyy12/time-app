'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface DataPoint {
  day: string
  count: number
}

interface CompletionChartProps {
  data: DataPoint[]
}

function formatDay(isoDay: string): string {
  const d = new Date(isoDay + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function useIsDark() {
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const mo = new MutationObserver(check)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])
  return isDark
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
  isDark: boolean
}

const CustomTooltip = ({ active, payload, label, isDark }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-xl"
      style={{
        background: 'var(--tooltip-bg)',
        border: '1px solid var(--tooltip-border)',
      }}
    >
      <p className="mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{label ? formatDay(label) : ''}</p>
      <p className={`font-semibold ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>{payload[0].value} completed</p>
    </div>
  )
}

export function CompletionChart({ data }: CompletionChartProps) {
  const isDark = useIsDark()
  const tickColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.40)'
  const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'
  const cursorColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
  const barColor = isDark ? 'rgba(122,170,206,0.70)' : 'rgba(53,88,114,0.65)'

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No completions in this period
      </div>
    )
  }

  return (
    <div className="h-48" role="img" aria-label="Task completions bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={gridColor} />
          <XAxis
            dataKey="day"
            tickFormatter={formatDay}
            tick={{ fill: tickColor, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: tickColor, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip isDark={isDark} />} cursor={{ fill: cursorColor }} />
          <Bar dataKey="count" fill={barColor} radius={[3, 3, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
