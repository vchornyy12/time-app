import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GoogleCalendarCard } from '@/components/settings/GoogleCalendarCard'

export const metadata: Metadata = { title: 'Settings' }

const ERROR_MESSAGES: Record<string, string> = {
  google_auth_denied: 'Google Calendar connection was cancelled.',
  invalid_state: 'Authentication failed — please try again.',
  token_exchange_failed: 'Could not complete Google sign-in. Please try again.',
  no_refresh_token: 'No refresh token returned. Try disconnecting and reconnecting.',
  db_error: 'Failed to save connection. Please try again.',
}

interface PageProps {
  searchParams: Promise<{ connected?: string; error?: string }>
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const { connected, error } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: integration } = await supabase
    .from('user_integrations')
    .select('google_refresh_token')
    .eq('user_id', user.id)
    .maybeSingle()

  const isConnected = !!integration?.google_refresh_token

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage your integrations and preferences</p>
      </div>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>
          Integrations
        </h2>
        <GoogleCalendarCard
          isConnected={isConnected}
          errorMessage={error ? (ERROR_MESSAGES[error] ?? 'Something went wrong.') : undefined}
          justConnected={connected === '1'}
        />
      </section>
    </div>
  )
}
