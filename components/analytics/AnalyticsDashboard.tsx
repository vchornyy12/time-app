'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { PeriodSelector, getPeriodFrom, type Period } from './PeriodSelector'
import { StatCard } from './StatCard'
import { RecentCompletions } from './RecentCompletions'

// Load chart components client-only to avoid recharts SSR issues
const CompletionChart = dynamic(() => import('./CompletionChart').then(m => ({ default: m.CompletionChart })), { ssr: false })
const StatusDistribution = dynamic(() => import('./StatusDistribution').then(m => ({ default: m.StatusDistribution })), { ssr: false })

// ── Types ──────────────────────────────────────────────────────

type DayPoint = { day: string; count: number }
type RecentTask = { id: string; title: string; completed_at: string }

export type AnalyticsData = {
  completedByDay: DayPoint[]
  avgCycleDays: number | null
  tasksCaptured: number
  statusCounts: Record<string, number>
  recentCompletions: RecentTask[]
}

// ── Helpers ────────────────────────────────────────────────────

async function fetchAnalytics(period: Period): Promise<AnalyticsData> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const from = getPeriodFrom(period).toISOString()

  const [rpcResult, recentResult] = await Promise.all([
    supabase.rpc('get_analytics', { p_user_id: user.id, p_from: from }),
    supabase
      .from('tasks')
      .select('id, title, completed_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(10),
  ])

  const rpc = rpcResult.data as {
    completed_by_day: Array<{ day: string; count: number }> | null
    avg_cycle_days: number | null
    tasks_captured: number | null
    status_counts: Record<string, number> | null
  } | null

  return {
    completedByDay: rpc?.completed_by_day ?? [],
    avgCycleDays: rpc?.avg_cycle_days ?? null,
    tasksCaptured: rpc?.tasks_captured ?? 0,
    statusCounts: rpc?.status_counts ?? {},
    recentCompletions: (recentResult.data ?? []) as RecentTask[],
  }
}

// ── Component ─────────────────────────────────────────────────

interface AnalyticsDashboardProps {
  initialData: AnalyticsData
}

export function AnalyticsDashboard({ initialData }: AnalyticsDashboardProps) {
  const [period, setPeriod] = useState<Period>('30d')
  const [data, setData] = useState<AnalyticsData>(initialData)
  const [loading, setLoading] = useState(false)

  async function handlePeriodChange(p: Period) {
    setPeriod(p)
    setLoading(true)
    try {
      const next = await fetchAnalytics(p)
      setData(next)
    } catch {
      // RPC not available yet — silently keep existing data
    } finally {
      setLoading(false)
    }
  }

  const totalCompleted = data.completedByDay.reduce((s, d) => s + d.count, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Header + period selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold gradient-heading">Analytics</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Your GTD system at a glance</p>
        </div>
        <PeriodSelector value={period} onChange={handlePeriodChange} />
      </div>

      {/* Stat cards row */}
      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
        <StatCard
          label="Completed"
          value={totalCompleted}
          sublabel={`in last ${period === '7d' ? '7 days' : period === '30d' ? '30 days' : '3 months'}`}
          accent="emerald"
        />
        <StatCard
          label="Avg cycle time"
          value={data.avgCycleDays != null ? `${data.avgCycleDays}d` : '—'}
          sublabel="from capture to done"
          accent="indigo"
        />
        <StatCard
          label="Captured"
          value={data.tasksCaptured}
          sublabel="new tasks added"
          accent="amber"
        />
        <StatCard
          label="Active projects"
          value={data.statusCounts['next_actions'] != null
            ? Object.entries(data.statusCounts)
                .filter(([k]) => !['done', 'trash'].includes(k))
                .reduce((s, [, v]) => s + v, 0)
            : '—'
          }
          sublabel="tasks in system"
        />
      </div>

      {/* Completion chart */}
      <div className={`glass-card p-5 transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
        <p className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Daily Completions</p>
        <CompletionChart data={data.completedByDay} />
      </div>

      {/* Bottom row: status distribution + recent completions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`glass-card p-5 transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
          <p className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Task Distribution</p>
          <StatusDistribution counts={data.statusCounts} />
        </div>

        <div className="glass-card p-5">
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Recent Completions</p>
          <RecentCompletions tasks={data.recentCompletions} />
        </div>
      </div>
    </div>
  )
}
