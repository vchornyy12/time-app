import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SomedayList } from '@/components/tasks/SomedayList'

export const metadata: Metadata = { title: 'Someday / Maybe' }

export default async function SomedayPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'someday_maybe')
    .order('created_at', { ascending: false })

  const tasks = data ?? []

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold gradient-heading">Someday / Maybe</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Ideas and possibilities for later — no pressure
          </p>
        </div>
        {tasks.length > 0 && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {tasks.length} {tasks.length === 1 ? 'idea' : 'ideas'}
          </span>
        )}
      </div>

      <SomedayList tasks={tasks} />
    </div>
  )
}
