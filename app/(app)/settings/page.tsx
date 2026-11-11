import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getUser } from '@/lib/supabase/server'
import { GoogleCalendarCard } from '@/components/settings/GoogleCalendarCard'
import { AccountCard } from '@/components/settings/AccountCard'
import { GmailInboxCard } from '@/components/settings/GmailInboxCard'
import { gmailAvailable } from '@/lib/gmail/config'
import type { GmailSettings } from '@/lib/gmail/settings'
import { LLMKeyCard } from '@/components/settings/LLMKeyCard'

export const metadata: Metadata = { title: 'Settings' }

const ERROR_MESSAGES: Record<string, string> = {
  google_auth_denied: 'Google Calendar connection was cancelled.',
  invalid_state: 'Authentication failed — please try again.',
  token_exchange_failed: 'Could not complete Google sign-in. Please try again.',
  no_refresh_token: 'No refresh token returned. Try disconnecting and reconnecting.',
  db_error: 'Failed to save connection. Please try again.',
}

interface PageProps {
  searchParams: Promise<{ connected?: string; error?: string; gmail?: string }>
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const { connected, error, gmail } = await searchParams

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

  const isConnected = !!integration?.google_connected
  const calendarConnected = integration?.calendar_connected ?? false
  const { data: llmSettings } = await supabase.from('user_llm_settings')
    .select('connected, model').eq('user_id', user.id).maybeSingle()
  const gmailEnabled = gmailAvailable()
  // Feature gate keeps existing deployments working before the migration runs.
  let gmailSettings: GmailSettings | null = null
  let gmailLoadError = false
  if (gmailEnabled) {
    const result = await supabase.from('gmail_integrations')
      .select('account_email, connected, scan_frequency, scan_time, scan_timezone, scan_batch_size, auto_scan_consent').eq('user_id', user.id).maybeSingle()
    gmailSettings = result.data as GmailSettings | null
    gmailLoadError = !!result.error
  }

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
        <GmailInboxCard key={`${gmailSettings?.account_email}:${gmailSettings?.connected}`}
          settings={gmailSettings} available={gmailEnabled} loadError={gmailLoadError} result={gmail} />
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>AI</h2>
        <LLMKeyCard connected={!!llmSettings?.connected} model={llmSettings?.model ?? 'gpt-4o-mini'} />
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
