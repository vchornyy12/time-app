import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getUser } from '@/lib/supabase/server'
import { InboxList } from '@/components/tasks/InboxList'
import { getUserContexts } from '@/lib/actions/contexts'
import { SuggestionsPanel } from '@/components/tasks/SuggestionsPanel'
import type { AgentSuggestion } from '@/lib/types'

export const metadata: Metadata = { title: 'Inbox' }

export default async function InboxPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await getUser()

  if (!user) redirect('/login')

  const [{ data: tasks }, userContexts, { data: suggestions }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'inbox')
      .order('created_at', { ascending: false }),
    getUserContexts(),
    supabase
      .from('agent_suggestions')
      .select('id, task_id, kind, reason, evidence_url, evidence_quote, draft_message, payload, status, external_ref, created_at, task:tasks(title, status, delegated_to, due_date)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const list = tasks ?? []

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold gradient-heading">Inbox</h1>
        {list.length > 0 && (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {list.length} {list.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      <SuggestionsPanel suggestions={(suggestions ?? []) as unknown as AgentSuggestion[]} />

      <InboxList tasks={list} userContexts={userContexts} />
    </div>
  )
}
