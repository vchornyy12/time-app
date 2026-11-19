import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createGoogleOAuthState, GOOGLE_OAUTH_TTL } from '@/lib/google/oauth-state'
import { CHAT_OAUTH_COOKIE, CHAT_SCOPES, chatOAuthConfigured } from '@/lib/google-chat/client'
import { publicOrigin } from '@/lib/mcp/auth'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))
  const origin = publicOrigin(request.url)
  if (!chatOAuthConfigured()) return NextResponse.redirect(`${origin}/settings?error=chat_not_configured`)
  const pending = createGoogleOAuthState(user.id, '/settings')
  const jar = await cookies()
  jar.set(CHAT_OAUTH_COOKIE, pending.cookie, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: GOOGLE_OAUTH_TTL,
  })
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CHAT_CLIENT_ID!, redirect_uri: `${origin}/api/google-chat/callback`,
    response_type: 'code', scope: CHAT_SCOPES.join(' '), access_type: 'offline', prompt: 'consent',
    include_granted_scopes: 'true', state: pending.state, code_challenge: pending.challenge, code_challenge_method: 'S256',
  })
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
