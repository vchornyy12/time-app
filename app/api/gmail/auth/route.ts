import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createGoogleOAuthState, GOOGLE_OAUTH_TTL } from '@/lib/google/oauth-state'
import { gmailAvailable, gmailOrigin, GMAIL_OAUTH_COOKIE, GMAIL_SCOPE } from '@/lib/gmail/config'

export async function GET(request: NextRequest) {
  if (!gmailAvailable()) return NextResponse.json({ error: 'Gmail is not configured.' }, { status: 503 })
  const origin = gmailOrigin(request.nextUrl.origin)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', origin))

  const pending = createGoogleOAuthState(user.id, '/settings')
  const jar = await cookies()
  jar.set(GMAIL_OAUTH_COOKIE, pending.cookie, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', maxAge: GOOGLE_OAUTH_TTL,
  })
  const params = new URLSearchParams({
    client_id: process.env.GMAIL_CLIENT_ID!, redirect_uri: `${origin}/api/gmail/callback`,
    response_type: 'code', scope: GMAIL_SCOPE, access_type: 'offline', prompt: 'consent',
    state: pending.state, code_challenge: pending.challenge, code_challenge_method: 'S256',
  })
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
