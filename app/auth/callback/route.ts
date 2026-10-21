import { saveGoogleIntegration } from '@/lib/google/integration'
import { createClient } from '@/lib/supabase/server'
import { safeInternalPath } from '@/lib/google/oauth-state'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeInternalPath(searchParams.get('next'), '/inbox')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const providerRefreshToken = data?.session?.provider_refresh_token
      if (data.session && (providerRefreshToken || data.session.provider_token)) {
        // Persist only the Supabase session. Provider credentials belong in Vault,
        // not in browser-readable Supabase cookies.
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token, refresh_token: data.session.refresh_token,
        })
        if (sessionError) {
          await supabase.auth.signOut({ scope: 'local' })
          return NextResponse.redirect(`${origin}/login?error=auth`)
        }
      }

      if (providerRefreshToken) {
        // Google granted calendar access alongside auth — store the token immediately.
        const userId = data.session?.user?.id
        if (userId) {
          try { await saveGoogleIntegration(userId, providerRefreshToken, true) } catch {
            return NextResponse.redirect(`${origin}/settings?error=db_error`)
          }
        }
        return NextResponse.redirect(`${origin}${next}`)
      }

      // No provider token — for new users, send them through the dedicated
      // Google Calendar OAuth so they can optionally grant calendar access.
      const user = data?.session?.user
      if (user) {
        const isNewUser = Date.now() - new Date(user.created_at).getTime() < 60_000
        if (isNewUser) {
          return NextResponse.redirect(
            `${origin}/api/google/auth?next=${encodeURIComponent(next)}`
          )
        }
      }

      // `next` defaults to /inbox; password-reset flow passes next=/update-password
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
