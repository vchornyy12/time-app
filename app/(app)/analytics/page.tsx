import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnalyticsDashboard, type AnalyticsData } from '@/components/analytics/AnalyticsDashboard'

export const metadata: Metadata = { title: 'Analytics' }

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const from = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()

  let initialData: AnalyticsData = {
    completedByDay: [],
    avgCycleDays: null,
    tasksCaptured: 0,
    statusCounts: {},
    recentCompletions: [],
  }

  try {
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

    initialData = {
      completedByDay: rpc?.completed_by_day ?? [],
      avgCycleDays: rpc?.avg_cycle_days ?? null,
      tasksCaptured: rpc?.tasks_captured ?? 0,
      statusCounts: rpc?.status_counts ?? {},
      recentCompletions: (recentResult.data ?? []) as Array<{
        id: string
        title: string
        completed_at: string
      }>,
    }
  } catch {
    // RPC not yet applied — gracefully fall back to empty state
  }

  return (
    <div className="max-w-4xl">
      <AnalyticsDashboard initialData={initialData} />
    </div>
  )
}
