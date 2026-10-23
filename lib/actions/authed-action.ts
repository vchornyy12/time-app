import { createClient, getUser } from '@/lib/supabase/server'
import { actionContext, type ActionContext } from './action-context'

/**
 * Returns an authenticated Supabase client and the current user.
 * Throws 'Unauthorized' if there is no active session.
 * Centralises the auth check so every server action stays DRY.
 */
export async function authedClient(): Promise<ActionContext> {
  const context = actionContext.getStore()
  if (context) return context
  const supabase = await createClient()
  const {
    data: { user },
  } = await getUser()
  if (!user) throw new Error('Unauthorized')
  return { supabase, user }
}
