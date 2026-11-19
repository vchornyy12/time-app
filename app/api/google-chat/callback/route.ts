import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { verifyGoogleOAuthState } from '@/lib/google/oauth-state'
import { setAssistantSecret } from '@/lib/assistant/secrets'
import { publicOrigin } from '@/lib/mcp/auth'
import { CHAT_OAUTH_COOKIE } from '@/lib/google-chat/client'

const REQUIRED = [
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages.readonly',
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const origin = publicOrigin(request.url)
  const settings = `${origin}/settings`
  const jar = await cookies()
  const pendingCookie = jar.get(CHAT_OAUTH_COOKIE)?.value
  // Consume the browser binding on every callback, including cancellation/errors.
  jar.set(CHAT_OAUTH_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const pending = user ? verifyGoogleOAuthState(pendingCookie, searchParams.get('state'), user.id) : null
  if (!user || !pending) return NextResponse.redirect(`${settings}?error=invalid_state`)
  const code = searchParams.get('code')
  if (searchParams.get('error') || !code) return NextResponse.redirect(`${settings}?error=chat_auth_denied`)

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_CHAT_CLIENT_ID!, client_secret: process.env.GOOGLE_CHAT_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/google-chat/callback`, grant_type: 'authorization_code', code_verifier: pending.verifier,
    }),
    cache: 'no-store',
  })
  if (!tokenRes.ok) return NextResponse.redirect(`${settings}?error=token_exchange_failed`)
  const tokens = await tokenRes.json()
  if (typeof tokens.refresh_token !== 'string') return NextResponse.redirect(`${settings}?error=no_refresh_token`)
  const granted = String(tokens.scope ?? '').split(' ')
  if (!REQUIRED.every((s) => granted.includes(s))) return NextResponse.redirect(`${settings}?error=chat_scopes_missing`)

  let email: string | undefined
  try {
    const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${tokens.access_token}` }, cache: 'no-store',
    }).then((r) => r.json())
    if (typeof info.email === 'string') email = info.email
  } catch { /* the email is only shown in Settings */ }

  try { await setAssistantSecret(user.id, 'chat', tokens.refresh_token, email) } catch {
    return NextResponse.redirect(`${settings}?error=db_error`)
  }
  return NextResponse.redirect(`${settings}?chat_connected=1`)
}
