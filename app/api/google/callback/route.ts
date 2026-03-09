import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawState = searchParams.get('state') ?? ''
  const error = searchParams.get('error')

  // State format: "{userId}|{encodedNext}"
  const pipeIndex = rawState.indexOf('|')
  const stateUserId = pipeIndex !== -1 ? rawState.slice(0, pipeIndex) : rawState
  const nextPath = pipeIndex !== -1 ? decodeURIComponent(rawState.slice(pipeIndex + 1)) : '/settings'

  const settingsUrl = `${origin}/settings`

  if (error || !code) {
    // User declined — if they were being onboarded, send to inbox anyway
    const fallback = nextPath.startsWith('/settings') ? settingsUrl : `${origin}${nextPath}`
    return NextResponse.redirect(`${fallback}?error=google_auth_denied`)
  }

  // Verify the session is still valid and state matches the authenticated user
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== stateUserId) {
    return NextResponse.redirect(`${settingsUrl}?error=invalid_state`)
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

  // Upsert the integration row — one row per user
  const { error: dbError } = await supabase
    .from('user_integrations')
    .upsert(
      {
        user_id: user.id,
        google_refresh_token: refreshToken,
        google_calendar_id: 'primary',
        calendar_connected: calendarConnected,
      },
      { onConflict: 'user_id' }
    )

  if (dbError) {
    return NextResponse.redirect(`${settingsUrl}?error=db_error`)
  }

  // Redirect: settings gets the connected banner; other destinations go straight there
  if (nextPath.startsWith('/settings')) {
    return NextResponse.redirect(`${settingsUrl}?connected=1`)
  }
  return NextResponse.redirect(`${origin}${nextPath}`)
}
