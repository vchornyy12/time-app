import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TrashList } from '@/components/tasks/TrashList'

export const metadata: Metadata = { title: 'Trash' }

export default async function TrashPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Most recently deleted first
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'trash')
    .order('updated_at', { ascending: false })

  const tasks = data ?? []

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Trash</h1>
          {tasks.length > 0 && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Items here are not permanently deleted yet
            </p>
          )}
        </div>
        {tasks.length > 0 && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {tasks.length} {tasks.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      <TrashList tasks={tasks} />
    </div>
  )
}
