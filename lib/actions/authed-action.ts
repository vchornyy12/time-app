import { createClient } from '@/lib/supabase/server'

/**
 * Returns an authenticated Supabase client and the current user.
 * Throws 'Unauthorized' if there is no active session.
 * Centralises the auth check so every server action stays DRY.
 */
export async function authedClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return { supabase, user }
}
