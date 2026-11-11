import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { verifyGoogleOAuthState } from '@/lib/google/oauth-state'
import { gmailAvailable, gmailOrigin, GMAIL_OAUTH_COOKIE, GMAIL_SCOPE } from '@/lib/gmail/config'
import { saveGmailIntegration } from '@/lib/gmail/integration'

const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1), scope: z.string() })
const profileSchema = z.object({ emailAddress: z.email() })

export async function GET(request: NextRequest) {
  const origin = gmailOrigin(request.nextUrl.origin)
  const result = (status: string) => {
    const response = NextResponse.redirect(new URL(`/settings?gmail=${status}`, origin))
    response.headers.set('Cache-Control', 'no-store')
    return response
  }
  const jar = await cookies()
  const saved = jar.get(GMAIL_OAUTH_COOKIE)?.value
  jar.set(GMAIL_OAUTH_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true,
    secure: process.env.NODE_ENV === 'production', sameSite: 'lax' })
  if (!gmailAvailable()) return result('unavailable')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const params = request.nextUrl.searchParams
  const pending = user ? verifyGoogleOAuthState(saved, params.get('state'), user.id) : null
  if (!user || !pending) return result('invalid_state')
  const code = params.get('code')
  if (params.has('error') || !code) return result('cancelled')

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: process.env.GMAIL_CLIENT_ID!, client_secret: process.env.GMAIL_CLIENT_SECRET!,
        redirect_uri: `${origin}/api/gmail/callback`, grant_type: 'authorization_code',
        code_verifier: pending.verifier,
      }), signal: AbortSignal.timeout(15000), cache: 'no-store',
    })
    if (!tokenResponse.ok) return result('failed')
    const tokens = tokenSchema.safeParse(await tokenResponse.json())
    if (!tokens.success || !tokens.data.scope.split(/\s+/).includes(GMAIL_SCOPE)) return result('missing_scope')

    // Bind deduplication to the Gmail account, which can differ from the app login.
    const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.data.access_token}` },
      signal: AbortSignal.timeout(15000), cache: 'no-store',
    })
    if (!profileResponse.ok) return result('failed')
    const profile = profileSchema.parse(await profileResponse.json())
    await saveGmailIntegration(user.id, profile.emailAddress, tokens.data.refresh_token)
    return result('connected')
  } catch {
    // Never expose Google's response bodies or credentials in logs/redirects.
    return result('failed')
  }
}
