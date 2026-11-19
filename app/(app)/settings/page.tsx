import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getUser } from '@/lib/supabase/server'
import { GoogleCalendarCard } from '@/components/settings/GoogleCalendarCard'
import { AccountCard } from '@/components/settings/AccountCard'
import { AIAssistantsCard } from '@/components/settings/AIAssistantsCard'
import { headers } from 'next/headers'
import { mcpEnabled } from '@/lib/mcp/auth'
import { agentActivity } from '@/lib/mcp/activity'
import { AssistantCard } from '@/components/settings/AssistantCard'
import { chatOAuthConfigured } from '@/lib/google-chat/client'

export const metadata: Metadata = { title: 'Settings' }

const ERROR_MESSAGES: Record<string, string> = {
  google_auth_denied: 'Google Calendar connection was cancelled.',
  invalid_state: 'Authentication failed — please try again.',
  token_exchange_failed: 'Could not complete Google sign-in. Please try again.',
  no_refresh_token: 'No refresh token returned. Try disconnecting and reconnecting.',
  db_error: 'Failed to save connection. Please try again.',
  chat_auth_denied: 'Google Chat connection was cancelled.',
  chat_scopes_missing: 'Google Chat needs read access to spaces and messages. Please allow both.',
  chat_not_configured: 'Google Chat is not configured on this server.',
}

interface PageProps {
  searchParams: Promise<{ connected?: string; error?: string; chat_connected?: string }>
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const { connected, error, chat_connected } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await getUser()

  if (!user) redirect('/login')

  const { data: integration } = await supabase
    .from('user_integrations')
    .select('google_connected, calendar_connected')
    .eq('user_id', user.id)
    .maybeSingle()

  let agent: { connectorUrl: string; lastActivityAt: string | null; capturedLast7Days: number } | null = null
  let assistant: { chat_connected: boolean; chat_account_email: string | null; notify_connected: boolean } | null = null
  let profile: { instructions: string; muted: string[] } | null = null
  if (mcpEnabled()) {
    const h = await headers()
    const requestUrl = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host') ?? 'localhost'}`
    const [activity, integrationRow, profileRow] = await Promise.all([
      agentActivity(supabase, user.id, requestUrl),
      supabase.from('assistant_integrations').select('chat_connected, chat_account_email, notify_connected').eq('user_id', user.id).maybeSingle(),
      supabase.from('agent_profiles').select('instructions, muted').eq('user_id', user.id).maybeSingle(),
    ])
    agent = activity
    assistant = integrationRow.data
    profile = profileRow.data
  }

  const isConnected = !!integration?.google_connected
  const calendarConnected = integration?.calendar_connected ?? false

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold gradient-heading">Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage your integrations and preferences</p>
      </div>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>
          Integrations
        </h2>
        <GoogleCalendarCard
          isConnected={isConnected}
          calendarConnected={calendarConnected}
          errorMessage={error ? (ERROR_MESSAGES[error] ?? 'Something went wrong.') : undefined}
          justConnected={connected === '1'}
        />
        {agent && <div className="mt-4"><AIAssistantsCard {...agent} /></div>}
        {agent && (
          <div className="mt-4">
            <AssistantCard
              chatConfigured={chatOAuthConfigured()}
              chatConnected={assistant?.chat_connected ?? false}
              chatEmail={assistant?.chat_account_email ?? null}
              notifyConnected={assistant?.notify_connected ?? false}
              instructions={profile?.instructions ?? ''}
              muted={profile?.muted ?? []}
              justConnectedChat={chat_connected === '1'}
            />
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>
          Account
        </h2>
        <AccountCard email={user.email ?? ''} />
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>
          Support
        </h2>
        <div
          className="px-5 py-5 rounded-xl flex items-start justify-between gap-6"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Support the developer
            </p>
            <p className="text-xs mt-1.5 leading-relaxed max-w-sm" style={{ color: 'var(--text-tertiary)' }}>
              time24 is free and built with passion as a solo project. If it helps you stay
              organised, a coffee goes a long way. ☕
            </p>
          </div>
          <a
            href="https://buymeacoffee.com/vchornyy12"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            style={{
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            ☕ Buy me a coffee
          </a>
        </div>
      </section>
    </div>
  )
}
