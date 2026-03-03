import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CalendarList } from '@/components/tasks/CalendarList'

export const metadata: Metadata = { title: 'Calendar' }

export default async function CalendarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch tasks + integration status in parallel — both depend only on user.id
  const [tasksResult, integrationResult] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'calendar')
      .order('scheduled_at', { ascending: true, nullsFirst: false }),
    supabase
      .from('user_integrations')
      .select('google_refresh_token')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const tasks = tasksResult.data ?? []
  const isGoogleConnected = !!integrationResult.data?.google_refresh_token

  const unsyncedCount = isGoogleConnected
    ? tasks.filter((t) => !t.google_calendar_event_id).length
    : 0

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Calendar</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Time-specific commitments, sorted by date
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unsyncedCount > 0 && (
            <span className="text-xs text-amber-400/70 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden="true" />
              {unsyncedCount} unsynced
            </span>
          )}
          {tasks.length > 0 && (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {tasks.length} {tasks.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
      </div>

      <CalendarList tasks={tasks} isGoogleConnected={isGoogleConnected} />
    </div>
  )
}
