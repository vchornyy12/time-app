import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/inbox'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const providerRefreshToken = data?.session?.provider_refresh_token

      if (providerRefreshToken) {
        // Google granted calendar access alongside auth — store the token immediately.
        const userId = data.session?.user?.id
        if (userId) {
          await supabase
            .from('user_integrations')
            .upsert(
              {
                user_id: userId,
                google_refresh_token: providerRefreshToken,
                google_calendar_id: 'primary',
                calendar_connected: true,
              },
              { onConflict: 'user_id' }
            )
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
