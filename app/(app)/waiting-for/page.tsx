import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WaitingForList } from '@/components/tasks/WaitingForList'

export const metadata: Metadata = { title: 'Waiting For' }

export default async function WaitingForPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Uncommunicated items first, then by due_date
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'waiting_for')
    .order('is_delegation_communicated', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  const tasks = data ?? []

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Waiting For</h1>
        {tasks.length > 0 && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {tasks.length} {tasks.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      <WaitingForList tasks={tasks} />
    </div>
  )
}
