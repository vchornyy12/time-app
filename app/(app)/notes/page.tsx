import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SimpleList } from '@/components/tasks/SimpleList'

export const metadata: Metadata = { title: 'Notes' }

export default async function NotesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'notes')
    .order('created_at', { ascending: false })

  const tasks = data ?? []

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Notes</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Reference material — not actionable, but worth keeping
          </p>
        </div>
        {tasks.length > 0 && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {tasks.length} {tasks.length === 1 ? 'note' : 'notes'}
          </span>
        )}
      </div>

      <SimpleList
        tasks={tasks}
        emptyIcon="📝"
        emptyTitle="No notes yet."
        emptyDescription="Reference items you file during processing will appear here."
      />
    </div>
  )
}
