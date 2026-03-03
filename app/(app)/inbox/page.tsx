import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InboxList } from '@/components/tasks/InboxList'
import { getUserContexts } from '@/lib/actions/contexts'

export const metadata: Metadata = { title: 'Inbox' }

export default async function InboxPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: tasks }, userContexts] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'inbox')
      .order('created_at', { ascending: false }),
    getUserContexts(),
  ])

  const list = tasks ?? []

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Inbox</h1>
        {list.length > 0 && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {list.length} {list.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      <InboxList tasks={list} userContexts={userContexts} />
    </div>
  )
}
