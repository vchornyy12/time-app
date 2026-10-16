'use client'

import { useState, useEffect, useTransition } from 'react'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import { saveWeeklyReviewComplete } from '@/lib/actions/preferences'

interface WeekStats {
  completedThisWeek: number
  capturedThisWeek: number
  projectsCompletedThisWeek: number
  activeProjects: number
  nextActions: number
  inbox: number
}

export function ReviewStep6Summary({ onComplete }: { onComplete: () => void }) {
  const [stats, setStats] = useState<WeekStats | null>(null)
  const [isSaving, startTransition] = useTransition()
  const [saveError, setSaveError] = useState(false)
  const [statsError, setStatsError] = useState(false)
  const [reload, setReload] = useState(0)

  function finish() {
    if (isSaving) return
    setSaveError(false)
    startTransition(async () => {
      try {
        await saveWeeklyReviewComplete()
        onComplete()
      } catch { setSaveError(true) }
    })
  }

  useEffect(() => {
    let mounted = true

    // Load weekly stats
    async function loadStats() {
      try {
        const supabase = createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')
        if (!mounted) return

        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const since = sevenDaysAgo.toISOString()

        const [
          completedResult,
          capturedResult,
          projectsCompletedResult,
          activeProjectsResult,
          nextActionsResult,
          inboxResult,
        ] = await Promise.all([
          // Tasks completed this week (requires completed_at column + trigger)
          supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'done')
            .gte('completed_at', since),
          // Tasks captured this week
          supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', since),
          // Projects completed this week
          supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .gte('updated_at', since),
          // Active projects count
          supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'active'),
          // Next actions count
          supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'next_actions'),
          // Inbox count
          supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'inbox'),
        ])

        if ([completedResult, capturedResult, projectsCompletedResult, activeProjectsResult, nextActionsResult, inboxResult]
          .some((result) => result.error || result.count === null)) throw new Error('Stats unavailable')
        if (!mounted) return
        setStatsError(false)
        setStats({
          completedThisWeek: completedResult.count ?? 0,
          capturedThisWeek: capturedResult.count ?? 0,
          projectsCompletedThisWeek: projectsCompletedResult.count ?? 0,
          activeProjects: activeProjectsResult.count ?? 0,
          nextActions: nextActionsResult.count ?? 0,
          inbox: inboxResult.count ?? 0,
        })
      } catch {
        if (mounted) setStatsError(true)
      }
    }

    loadStats()
    return () => { mounted = false }
  }, [reload])


  return (
    <div className="flex flex-col gap-5">
      {/* Review is only complete after the explicit save succeeds. */}
      <div className="text-center py-2">
        <div className="text-5xl mb-3" aria-hidden="true">📋</div>
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Ready to finish?</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>Check what remains, then save your weekly review.</p>
      </div>

      {/* Stats grid */}
      {statsError ? (
        <p role="alert">Could not load your summary. <button onClick={() => setReload((value) => value + 1)}>Retry summary</button></p>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            value={stats.completedThisWeek}
            label="Tasks completed"
            sublabel="this week"
            accent="emerald"
          />
          <StatCard
            value={stats.capturedThisWeek}
            label="Tasks captured"
            sublabel="this week"
          />
          <StatCard
            value={stats.activeProjects}
            label="Active projects"
            sublabel="in system"
          />
          <StatCard
            value={stats.nextActions}
            label="Next actions"
            sublabel="ready to go"
            accent="indigo"
          />
          {stats.projectsCompletedThisWeek > 0 && (
            <StatCard
              value={stats.projectsCompletedThisWeek}
              label="Projects finished"
              sublabel="this week"
              accent="indigo"
            />
          )}
          <StatCard
            value={stats.inbox}
            label="Inbox"
            sublabel={stats.inbox === 0 ? 'at zero ✓' : 'items remaining'}
            accent={stats.inbox === 0 ? 'emerald' : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />
          ))}
        </div>
      )}

      {saveError && <p role="alert">Your review could not be saved. Please try again; your progress is kept.</p>}
      <button
        onClick={finish}
        disabled={isSaving}
        className="btn-primary disabled:opacity-50"
      >
        {isSaving ? 'Saving review…' : saveError ? 'Retry saving review' : 'Finish and save review'}
      </button>
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────

function StatCard({
  value,
  label,
  sublabel,
  accent,
}: {
  value: number
  label: string
  sublabel: string
  accent?: 'emerald' | 'indigo'
}) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <p
        className={cn(
          'text-2xl font-bold leading-none',
          accent === 'emerald'
            ? 'text-emerald-500 dark:text-emerald-300'
            : accent === 'indigo'
            ? 'text-indigo-500 dark:text-indigo-300'
            : ''
        )}
        style={!accent ? { color: 'var(--text-primary)' } : undefined}
      >
        {value}
      </p>
      <p className="text-xs mt-1 leading-tight" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sublabel}</p>
    </div>
  )
}
