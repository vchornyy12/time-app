import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

/** JSON reply for the mobile API; never cached. */
export const reply = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } })

type Verified = { ok: true; supabase: SupabaseClient; user: User; body: unknown } | { ok: false; response: NextResponse }

/**
 * Verifies the mobile app's bearer token and reads the JSON body.
 * The Supabase client carries the user's token, so RLS scopes every query to them.
 */
export async function verifyMobileRequest(request: NextRequest): Promise<Verified> {
  const bearer = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1]
  if (!bearer || bearer.length > 8192) return { ok: false, response: reply({ error: 'Sign in again.' }, 401) }
  if (!request.headers.get('content-type')?.startsWith('application/json')) return { ok: false, response: reply({ error: 'Expected JSON.' }, 415) }
  let body: unknown
  try {
    const text = await request.text()
    if (text.length > 40000) return { ok: false, response: reply({ error: 'Request too large.' }, 413) }
    body = JSON.parse(text)
  } catch { return { ok: false, response: reply({ error: 'Invalid request.' }, 400) } }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${bearer}` } }, auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error } = await supabase.auth.getUser(bearer)
  if (error || !user) return { ok: false, response: reply({ error: 'Sign in again.' }, 401) }
  return { ok: true, supabase, user, body }
}
