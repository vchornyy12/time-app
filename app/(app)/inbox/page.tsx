import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getUser } from '@/lib/supabase/server'
import { InboxList } from '@/components/tasks/InboxList'
import { getUserContexts } from '@/lib/actions/contexts'
import { gmailAvailable } from '@/lib/gmail/config'
import { GmailInboxScanner } from '@/components/tasks/GmailInboxScanner'
import type { GmailScanRun } from '@/lib/actions/gmail'

export const metadata: Metadata = { title: 'Inbox' }

export default async function InboxPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await getUser()

  if (!user) redirect('/login')

  const [{ data: tasks }, userContexts, gmail] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'inbox')
      .order('created_at', { ascending: false }),
    getUserContexts(),
    gmailAvailable() ? supabase.from('gmail_integrations').select('connected,account_email,scan_batch_size').eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])

  const list = tasks ?? []
  const [gmailSuggestions, latestRun] = gmail?.data?.connected
    ? await Promise.all([loadSuggestions(supabase, user.id), loadLatestRun(supabase, user.id)])
    : [[], null]

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

      {gmail?.data?.connected && <GmailInboxScanner connected batchSize={gmail.data.scan_batch_size ?? 50} suggestions={gmailSuggestions} initialRun={latestRun} />}
      <InboxList tasks={list} userContexts={userContexts} />
    </div>
  )
}

async function loadSuggestions(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('gmail_task_suggestions')
    .select('id,message_id,subject,sender,received_at,title').eq('user_id', userId).eq('status', 'pending')
    .order('created_at', { ascending: true }).limit(50)
  return (data ?? []).map(row => ({ id: row.id, messageId: row.message_id, subject: row.subject,
    from: row.sender, date: row.received_at ?? '', title: row.title }))
}

async function loadLatestRun(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<GmailScanRun | null> {
  const { data } = await supabase.from('gmail_scan_runs')
    .select('id,kind,batch_size,status,processed_count,suggestion_count,error_message')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data as GmailScanRun | null
}
