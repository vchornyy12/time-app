import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { approveConnector, denyConnector } from '@/lib/actions/oauth-consent'
import { safeClientRedirect } from '@/lib/mcp/redirect'

export const metadata: Metadata = { title: 'Connect an AI assistant' }
export const dynamic = 'force-dynamic'

const ERRORS: Record<string, string> = {
  invalid_request: 'This connection request is incomplete. Start connecting again from your AI assistant.',
  expired: 'This connection request expired or was already used. Start connecting again from your AI assistant.',
  invalid_redirect: 'The assistant gave an unsafe return address, so the connection was stopped.',
}

const GRANTS = [
  'Add proposed items to your Inbox, with the email, meeting or message they came from',
  'Read your Inbox, Next Actions and Waiting For lists',
  'Remember where its last scan stopped',
]
const LIMITS = 'It cannot process, complete, move or delete tasks. You decide what happens to every item in the app.'

function Card({ children }: { children: React.ReactNode }) {
  return <div className="glass-card w-full max-w-md p-8 flex flex-col gap-5">{children}</div>
}

export default async function OAuthConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const errorMessage = params.error ? ERRORS[params.error] ?? ERRORS.invalid_request : null
  const authorizationId = params.authorization_id

  if (errorMessage || !authorizationId || !/^[A-Za-z0-9_-]{1,200}$/.test(authorizationId)) {
    return (
      <Card>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Connection not completed</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{errorMessage ?? ERRORS.invalid_request}</p>
      </Card>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`)

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
  if (error || !data) redirect('/oauth/consent?error=expired')
  if (!('authorization_id' in data)) {
    // Already approved earlier for this client: go straight back to it.
    const target = safeClientRedirect(data.redirect_url)
    redirect(target ?? '/oauth/consent?error=invalid_redirect')
  }

  const clientName = data.client.name?.trim() || 'An AI assistant'
  let clientHost = ''
  try { clientHost = new URL(data.redirect_uri).host } catch { /* shown without host */ }

  return (
    <Card>
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Connect {clientName} to Time24?
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Signed in as {data.user.email}{clientHost && <> · returns to <span className="font-mono">{clientHost}</span></>}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>It will be able to:</p>
        <ul className="flex flex-col gap-1.5 text-sm list-disc pl-5" style={{ color: 'var(--text-secondary)' }}>
          {GRANTS.map((g) => <li key={g}>{g}</li>)}
        </ul>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{LIMITS}</p>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Only approve if you started this connection yourself. You can disconnect it at any time in the assistant&apos;s connector settings.
      </p>

      <div className="flex gap-3">
        <form action={denyConnector} className="flex-1">
          <input type="hidden" name="authorization_id" value={data.authorization_id} />
          <button type="submit" className="btn-glass w-full">Cancel</button>
        </form>
        <form action={approveConnector} className="flex-1">
          <input type="hidden" name="authorization_id" value={data.authorization_id} />
          <button type="submit" className="btn-primary w-full">Allow</button>
        </form>
      </div>
    </Card>
  )
}
