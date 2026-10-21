import { NextRequest, NextResponse } from 'next/server'
import { saveGoogleIntegration } from '@/lib/google/integration'
import { cookies } from 'next/headers'
import { GOOGLE_OAUTH_COOKIE, verifyGoogleOAuthState } from '@/lib/google/oauth-state'
import { createClient } from '@/lib/supabase/server'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const settingsUrl = `${origin}/settings`
  const jar = await cookies()
  const pendingCookie = jar.get(GOOGLE_OAUTH_COOKIE)?.value
  // Consume the browser binding on every callback, including cancellation/errors.
  jar.set(GOOGLE_OAUTH_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true,
    secure: process.env.NODE_ENV === 'production', sameSite: 'lax' })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const pending = user ? verifyGoogleOAuthState(pendingCookie, searchParams.get('state'), user.id) : null
  if (!user || !pending) return NextResponse.redirect(`${settingsUrl}?error=invalid_state`)
  const nextPath = pending.next
  if (searchParams.get('error') || !code) {
    const fallback = new URL(nextPath, origin)
    fallback.searchParams.set('error', 'google_auth_denied')
    return NextResponse.redirect(fallback)
  }

  // Exchange authorization code for tokens
  const redirectUri = `${origin}/api/google/callback`
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: pending.verifier,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${settingsUrl}?error=token_exchange_failed`)
  }

  const tokens = await tokenRes.json()
  const refreshToken = tokens.refresh_token as string | undefined

  if (!refreshToken) {
    // Should not happen with prompt=consent, but handle defensively
    return NextResponse.redirect(`${settingsUrl}?error=no_refresh_token`)
  }

  // Check whether Google actually granted the calendar scope
  const grantedScopes: string = tokens.scope ?? ''
  const calendarConnected = grantedScopes.includes(CALENDAR_SCOPE)

  try { await saveGoogleIntegration(user.id, refreshToken, calendarConnected) } catch {
    return NextResponse.redirect(`${settingsUrl}?error=db_error`)
  }

  // Redirect: settings gets the connected banner; other destinations go straight there
  if (new URL(nextPath, origin).pathname === '/settings') {
    return NextResponse.redirect(`${settingsUrl}?connected=1`)
  }
  return NextResponse.redirect(`${origin}${nextPath}`)
}
