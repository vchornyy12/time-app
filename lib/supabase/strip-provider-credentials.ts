import type { SupabaseClient } from '@supabase/supabase-js'

// Call only after getUser/exchangeCodeForSession has verified this request.
// Existing sessions may still contain provider credentials from older releases.
export async function stripProviderCredentials(client: Pick<SupabaseClient, 'auth'>) {
  const { data: { session }, error } = await client.auth.getSession()
  if (error) throw new Error('Could not refresh session')
  if (!session || (!session.provider_token && !session.provider_refresh_token)) return
  const { error: refreshError } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (refreshError) throw new Error('Could not refresh session')
}
