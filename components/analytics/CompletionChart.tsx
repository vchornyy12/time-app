'use client'

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

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-[#0e1322] border border-white/[0.09] px-3 py-2 text-xs shadow-xl">
      <p className="text-white/50 mb-0.5">{formatDay(label)}</p>
      <p className="font-semibold text-indigo-300">{payload[0].value} completed</p>
    </div>
  )
}

export function CompletionChart({ data }: CompletionChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-white/25">
        No completions in this period
      </div>
    )
  }

  return (
    <div className="h-48" role="img" aria-label="Task completions bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="day"
            tickFormatter={formatDay}
            tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="count" fill="rgba(99,102,241,0.65)" radius={[3, 3, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
