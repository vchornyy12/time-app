import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TaskList } from '@/components/tasks/TaskList'
import { getUserContexts } from '@/lib/actions/contexts'

export const metadata: Metadata = { title: 'Next Actions' }

export default async function NextActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ context?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch next actions with project name; sort overdue/dated first
  const [{ data }, userContexts] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, projects!project_id(title)')
      .eq('user_id', user.id)
      .eq('status', 'next_actions')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
    getUserContexts(),
  ])

  const tasks = data ?? []
  const { context } = await searchParams

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Next Actions</h1>
        {tasks.length > 0 && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {tasks.length} {tasks.length === 1 ? 'action' : 'actions'}
          </span>
        )}
      </div>

      <TaskList
        tasks={tasks}
        userContexts={userContexts}
        initialContext={context ?? null}
        emptyIcon="⚡"
        emptyTitle="You're all caught up."
        emptyDescription="No next actions right now. Process your inbox to add some."
      />
    </div>
  )
}
