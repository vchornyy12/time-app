'use server'

import { revalidatePath } from 'next/cache'
import { authedClient } from '@/lib/actions/authed-action'

/**
 * Returns the ISO timestamp of the last completed weekly review, or null.
 * Gracefully returns null if the user_preferences table doesn't exist yet.
 */
export async function getLastWeeklyReview(): Promise<string | null> {
  try {
    const { supabase, user } = await authedClient()
    const { data } = await supabase
      .from('user_preferences')
      .select('last_weekly_review')
      .eq('user_id', user.id)
      .single()
    return data?.last_weekly_review ?? null
  } catch {
    return null
  }
}

/**
 * Upserts the current timestamp as the last_weekly_review for the current user.
 */
export async function saveWeeklyReviewComplete(): Promise<void> {
  const { supabase, user } = await authedClient()

  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, last_weekly_review: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  if (error) throw error
  revalidatePath('/weekly-review')
  revalidatePath('/', 'layout')
}
