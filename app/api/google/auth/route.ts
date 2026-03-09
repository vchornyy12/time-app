import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SCOPES = ['https://www.googleapis.com/auth/calendar.events']

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { origin, searchParams } = new URL(request.url)
  const redirectUri = `${origin}/api/google/callback`
  const next = searchParams.get('next') ?? '/settings'

  // Encode userId + post-OAuth destination in state for CSRF check + redirect
  const state = `${user.id}|${encodeURIComponent(next)}`

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',  // ensures a refresh_token is returned
    prompt: 'consent',       // force consent screen so refresh_token is always present
    state,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
