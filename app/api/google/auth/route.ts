import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createGoogleOAuthState, GOOGLE_OAUTH_COOKIE, GOOGLE_OAUTH_TTL, safeInternalPath } from '@/lib/google/oauth-state'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))
  const { origin, searchParams } = new URL(request.url)
  const pending = createGoogleOAuthState(user.id, safeInternalPath(searchParams.get('next')))
  const jar = await cookies()
  jar.set(GOOGLE_OAUTH_COOKIE, pending.cookie, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', maxAge: GOOGLE_OAUTH_TTL,
  })
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: `${origin}/api/google/callback`,
    response_type: 'code', scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline', prompt: 'consent', state: pending.state,
    code_challenge: pending.challenge, code_challenge_method: 'S256',
  })
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
